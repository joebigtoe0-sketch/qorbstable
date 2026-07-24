// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "./base/Ownable.sol";
import {ReentrancyGuard} from "./base/ReentrancyGuard.sol";
import {StableLocker} from "./StableLocker.sol";
import {IERC20Min, IUniswapV3FactoryMin, IUniswapV3PoolMin} from "./interfaces/IExternal.sol";
import {LiquidityAmounts} from "./libs/LiquidityAmounts.sol";
import {TickMath} from "./libs/TickMath.sol";
import {StableLaunchToken} from "./tokens/StableLaunchToken.sol";

/**
 * @title StableLaunchpad
 * @notice Launches fixed-supply tokens straight into a permanently locked
 * single-sided Uniswap v3 position — the pool IS the bonding curve. One
 * atomic transaction deploys the token (CREATE2, vanity-friendly), creates
 * and initializes the pool at the starting price, mints the entire supply as
 * liquidity from the start price up to the max tick, locks the position in
 * the StableLocker forever, and optionally executes the creator's dev buy.
 *
 * "Graduation" is cosmetic: `graduationStatus` reports how much USDT0 the
 * locked position has accumulated versus a threshold. Nothing migrates —
 * trading is on Uniswap v3 from the first block, visible to every terminal.
 *
 * Pools pair against Stable Chain's canonical ERC20 USDT0 (6 decimals) so
 * DEX Screener and terminals price every pair automatically. No wrapping:
 * dev buys pull USDT0 via transferFrom (approve first).
 */
contract StableLaunchpad is Ownable, ReentrancyGuard {
    enum Flavor {
        Standard, // clean token, pool fees split 50/50 creator/platform
        LPGrow, // clean token, 70% of pool fees reinvested into locked LP
        SuperLP // 5% buy tax swap-and-liquified into locked LP; fees split 50/50
    }

    uint24 public constant POOL_FEE = 10_000; // Uniswap v3 1% tier
    int24 public constant TICK_SPACING = 200;
    /// Start price ~4.0e-18 raw (USDT0 6-dec per token 18-dec) ≈ $4.0e-6 per
    /// token → 1B supply ≈ $4,000 starting market cap.
    int24 public constant INITIAL_TICK = -400_600;
    int24 public constant MAX_USABLE_TICK = 887_200; // (887272 / 200) * 200
    uint256 public constant GRADUATION_USD = 12_000e6; // $12,000 in 6-dec USDT0

    uint16 public constant LP_GROW_REINVEST_BPS = 7_000;
    uint16 public constant SUPER_LP_BUY_TAX_BPS = 500;

    address private constant DEAD = 0x000000000000000000000000000000000000dEaD;

    struct Launch {
        address creator;
        address pool;
        uint8 flavor;
        uint40 createdAt;
        bool isToken0;
    }

    IUniswapV3FactoryMin public immutable uniswapFactory;
    IERC20Min public immutable usdt0;
    StableLocker public immutable locker;

    address public feeRecipient;

    mapping(address => Launch) public launches;

    // Set for the duration of a mint/dev-buy so callbacks can verify the caller.
    address private _pendingPool;

    /// @dev name/symbol/metadataURI are readable from the token contract —
    /// keeping strings out of the event also keeps launchToken's stack shallow.
    event TokenLaunched(
        address indexed token,
        address indexed creator,
        address pool,
        uint8 flavor,
        uint256 devBuyUsd,
        uint256 devBuyTokens
    );
    event FeeRecipientUpdated(address recipient);

    constructor(address uniswapV3Factory_, address usdt0_, address feeRecipient_) Ownable(msg.sender) {
        require(uniswapV3Factory_ != address(0) && usdt0_ != address(0), "Launchpad: zero uniswap");
        require(feeRecipient_ != address(0), "Launchpad: zero fee recipient");
        uniswapFactory = IUniswapV3FactoryMin(uniswapV3Factory_);
        usdt0 = IERC20Min(usdt0_);
        feeRecipient = feeRecipient_;
        locker = new StableLocker(address(this));
    }

    function setFeeRecipient(address recipient) external onlyOwner {
        require(recipient != address(0), "Launchpad: zero fee recipient");
        feeRecipient = recipient;
        emit FeeRecipientUpdated(recipient);
    }

    /// @notice Infra addresses a freshly deploying token reads back mid-CREATE2.
    function launchContext()
        external
        view
        returns (address, address, address, uint24)
    {
        return (address(locker), address(uniswapFactory), address(usdt0), POOL_FEE);
    }

    /// @notice Deploys, pools, locks, and (optionally, devBuyUsd > 0) dev-buys
    /// a token in one transaction. The dev buy pulls USDT0 via transferFrom —
    /// approve the launchpad first. `salt` supports vanity address mining via
    /// `predictTokenAddress`.
    function launchToken(
        string calldata name,
        string calldata symbol,
        string calldata metadataURI,
        Flavor flavor,
        bytes32 salt,
        uint256 devBuyUsd,
        uint256 minDevBuyTokens
    ) external nonReentrant returns (address token) {
        // Clean coins only: every token this launchpad can ever deploy has 0%
        // tax and no reinvest hooks — enforced here, not in the UI, so no
        // direct contract call can mint a taxed token under our name. The
        // LP-growing flavors ship with a future launchpad version instead.
        require(flavor == Flavor.Standard, "Launchpad: standard only");
        require(bytes(name).length > 0 && bytes(symbol).length > 0, "Launchpad: name/symbol");

        (uint16 taxBps, uint16 reinvestBps) = _flavorParams(flavor);
        token = address(new StableLaunchToken{salt: salt}(name, symbol, metadataURI, msg.sender, taxBps));

        address pool = _setupPool(token, reinvestBps, uint8(flavor));

        uint256 devBuyTokens;
        if (devBuyUsd > 0) {
            devBuyTokens = _devBuy(
                IUniswapV3PoolMin(pool), token, token < address(usdt0), devBuyUsd, minDevBuyTokens
            );
        }

        emit TokenLaunched(token, msg.sender, pool, uint8(flavor), devBuyUsd, devBuyTokens);
    }

    /// @dev Creates + initializes the pool at the start price, mints the whole
    /// supply single-sided into the locker's permanent position, and records
    /// the launch. Reverts if the pool pre-exists (front-run grief on the
    /// predicted address) — relaunching with a new salt is free.
    function _setupPool(address token, uint16 reinvestBps, uint8 flavor) private returns (address pool) {
        require(
            uniswapFactory.getPool(token, address(usdt0), POOL_FEE) == address(0),
            "Launchpad: pool exists"
        );

        bool isToken0 = token < address(usdt0);
        (int24 tickLower, int24 tickUpper, int24 startTick) = _positionRange(isToken0);

        pool = uniswapFactory.createPool(token, address(usdt0), POOL_FEE);
        IUniswapV3PoolMin(pool).initialize(TickMath.getSqrtRatioAtTick(startTick));

        _mintFullSupply(IUniswapV3PoolMin(pool), token, isToken0, tickLower, tickUpper);

        // Dust the liquidity math rounded off; make it unambiguous supply-wise.
        uint256 leftover = IERC20Min(token).balanceOf(address(this));
        if (leftover > 0) IERC20Min(token).transfer(DEAD, leftover);

        locker.register(token, pool, msg.sender, reinvestBps, tickLower, tickUpper);
        launches[token] = Launch({
            creator: msg.sender,
            pool: pool,
            flavor: flavor,
            createdAt: uint40(block.timestamp),
            isToken0: isToken0
        });
    }

    /// @notice USDT0 accumulated inside the locked position vs the graduation
    /// threshold. Purely informational — nothing changes on-chain at
    /// graduation; the pool trades on Uniswap from block one either way.
    function graduationStatus(address token)
        external
        view
        returns (uint256 usdPrincipal, uint256 threshold, bool graduated)
    {
        Launch memory launch = launches[token];
        require(launch.pool != address(0), "Launchpad: unknown token");
        (,, uint16 reinvestBps, int24 tickLower, int24 tickUpper) = locker.locks(token);
        reinvestBps; // silence unused variable

        (uint160 sqrtP,,,,,,) = IUniswapV3PoolMin(launch.pool).slot0();
        bytes32 key = keccak256(abi.encodePacked(address(locker), tickLower, tickUpper));
        (uint128 liquidity,,,,) = IUniswapV3PoolMin(launch.pool).positions(key);
        (uint256 amount0, uint256 amount1) = LiquidityAmounts.getAmountsForLiquidity(
            sqrtP,
            TickMath.getSqrtRatioAtTick(tickLower),
            TickMath.getSqrtRatioAtTick(tickUpper),
            liquidity
        );

        usdPrincipal = launch.isToken0 ? amount1 : amount0;
        threshold = GRADUATION_USD;
        graduated = usdPrincipal >= threshold;
    }

    /// @notice Deterministic token address for the launch inputs — used by the
    /// vanity-salt miner. `creator` must be the wallet that will launch.
    function predictTokenAddress(
        string calldata name,
        string calldata symbol,
        string calldata metadataURI,
        Flavor flavor,
        bytes32 salt,
        address creator
    ) external view returns (address) {
        (uint16 taxBps,) = _flavorParams(flavor);
        bytes32 initCodeHash = keccak256(
            abi.encodePacked(
                type(StableLaunchToken).creationCode,
                abi.encode(name, symbol, metadataURI, creator, taxBps)
            )
        );
        return address(
            uint160(uint256(keccak256(abi.encodePacked(bytes1(0xff), address(this), salt, initCodeHash))))
        );
    }

    function _flavorParams(Flavor flavor) private pure returns (uint16 taxBps, uint16 reinvestBps) {
        if (flavor == Flavor.Standard) return (0, 0);
        if (flavor == Flavor.LPGrow) return (0, LP_GROW_REINVEST_BPS);
        // Super LP: the tax compounds via swap-and-liquify in the locker;
        // pool fees themselves are split 50/50 like Standard.
        return (SUPER_LP_BUY_TAX_BPS, 0);
    }

    /// @dev Token as token0: pool starts at the bottom of the range, all
    /// liquidity is token, buys push the price up through it. Token as token1:
    /// the mirrored picture — pool starts at the top, buys push the price down.
    function _positionRange(bool isToken0)
        private
        pure
        returns (int24 tickLower, int24 tickUpper, int24 startTick)
    {
        if (isToken0) {
            return (INITIAL_TICK, MAX_USABLE_TICK, INITIAL_TICK);
        }
        return (-MAX_USABLE_TICK, -INITIAL_TICK, -INITIAL_TICK);
    }

    function _mintFullSupply(
        IUniswapV3PoolMin pool,
        address token,
        bool isToken0,
        int24 tickLower,
        int24 tickUpper
    ) private {
        uint256 supply = IERC20Min(token).balanceOf(address(this));
        uint160 sqrtLower = TickMath.getSqrtRatioAtTick(tickLower);
        uint160 sqrtUpper = TickMath.getSqrtRatioAtTick(tickUpper);
        uint128 liquidity = isToken0
            ? LiquidityAmounts.getLiquidityForAmount0(sqrtLower, sqrtUpper, supply)
            : LiquidityAmounts.getLiquidityForAmount1(sqrtLower, sqrtUpper, supply);
        require(liquidity > 0, "Launchpad: zero liquidity");

        _pendingPool = address(pool);
        pool.mint(address(locker), tickLower, tickUpper, liquidity, abi.encode(token));
        _pendingPool = address(0);
    }

    function _devBuy(
        IUniswapV3PoolMin pool,
        address token,
        bool isToken0,
        uint256 usdIn,
        uint256 minTokensOut
    ) private returns (uint256 tokensOut) {
        require(usdt0.transferFrom(msg.sender, address(this), usdIn), "Launchpad: usdt0 pull");
        StableLaunchToken(token).setDevBuyRecipient(msg.sender);

        // Buying token with USDT0: zeroForOne means "token0 in", so direction
        // is "USDT0 side in".
        bool zeroForOne = !isToken0; // USDT0 is token0 exactly when token is token1
        _pendingPool = address(pool);
        (int256 amount0, int256 amount1) = pool.swap(
            msg.sender,
            zeroForOne,
            int256(usdIn),
            zeroForOne ? TickMath.MIN_SQRT_RATIO + 1 : TickMath.MAX_SQRT_RATIO - 1,
            abi.encode(token)
        );
        _pendingPool = address(0);

        StableLaunchToken(token).setDevBuyRecipient(address(0));
        tokensOut = uint256(-(isToken0 ? amount0 : amount1));
        require(tokensOut >= minTokensOut, "Launchpad: dev buy slippage");
    }

    /// @dev Pays the pool for the launch mint. The launch mints at the exact
    /// range boundary, so only the token side may ever be owed — any USDT0
    /// owed means the pool price was manipulated and the launch must fail.
    function uniswapV3MintCallback(uint256 amount0Owed, uint256 amount1Owed, bytes calldata data)
        external
    {
        require(msg.sender == _pendingPool, "Launchpad: bad callback");
        (address token) = abi.decode(data, (address));
        bool isToken0 = token < address(usdt0);
        uint256 usdOwed = isToken0 ? amount1Owed : amount0Owed;
        require(usdOwed == 0, "Launchpad: pool griefed");
        uint256 tokenOwed = isToken0 ? amount0Owed : amount1Owed;
        if (tokenOwed > 0) IERC20Min(token).transfer(msg.sender, tokenOwed);
    }

    /// @dev Pays the USDT0 leg of the atomic dev buy.
    function uniswapV3SwapCallback(int256 amount0Delta, int256 amount1Delta, bytes calldata data)
        external
    {
        require(msg.sender == _pendingPool, "Launchpad: bad callback");
        data; // token address, unused — USDT0 is always the side we owe
        uint256 owed0 = amount0Delta > 0 ? uint256(amount0Delta) : 0;
        uint256 owed1 = amount1Delta > 0 ? uint256(amount1Delta) : 0;
        uint256 usdOwed = owed0 > 0 ? owed0 : owed1;
        if (usdOwed > 0) usdt0.transfer(msg.sender, usdOwed);
    }
}
