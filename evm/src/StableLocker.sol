// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ReentrancyGuard} from "./base/ReentrancyGuard.sol";
import {IERC20Min, IUniswapV3PoolMin} from "./interfaces/IExternal.sol";
import {LiquidityAmounts} from "./libs/LiquidityAmounts.sol";
import {TickMath} from "./libs/TickMath.sol";

interface IStableLaunchpadFees {
    function feeRecipient() external view returns (address);
}

interface IStableTokenTax {
    function buyTaxBps() external view returns (uint16);
}

/// @notice Holds every Stable launch token's single-sided Uniswap v3 launch position
/// forever. There is deliberately NO function that can decrease liquidity —
/// the position is locked by construction. What the locker can do is collect
/// the pool's 1% swap fees (permissionlessly, by anyone) and route them:
///
///   Standard:   all collected fees split 50/50 creator / platform.
///   LP-Growing: `reinvestBps` (70%) of collected fees is re-added to the
///               locked position; the remainder is split 50/50.
///   Super LP:   fees split 50/50 exactly like Standard. Separately, the
///               token's permanent 5% buy tax accumulates here and `collect`
///               swap-and-liquifies it: half is sold to the pool for USDT0
///               (price impact capped per crank), paired with the other half,
///               and minted into the locked position — 100% of the tax
///               becomes permanently locked liquidity over time.
///
/// The token side of every payout is auto-sold to USDT0 inside collect (same
/// price-impact cap), so rewards arrive as dollars and the sale is attributed
/// to this contract — claimers' wallets never show up as sellers.
contract StableLocker is ReentrancyGuard {
    uint256 public constant BPS = 10_000;
    uint256 public constant CREATOR_SHARE_BPS = 5_000; // of the payout portion
    /// Per-crank cap on how far the tax-compounding sell may move sqrt(price),
    /// ~2.5% in price terms. A large tax pile compounds over several cranks.
    uint256 public constant COMPOUND_SQRT_LIMIT_BPS = 125;
    /// Don't bother compounding dust.
    uint256 public constant MIN_COMPOUND_TOKENS = 1_000 ether;

    struct Lock {
        address pool;
        address creator;
        uint16 reinvestBps;
        int24 tickLower;
        int24 tickUpper;
    }

    address public immutable launchpad;

    mapping(address => Lock) public locks;

    // Set for the duration of a mint so the callback can verify the caller.
    address private _pendingPool;

    event PositionLocked(
        address indexed token, address indexed pool, uint16 reinvestBps, int24 tickLower, int24 tickUpper
    );
    event FeesCollected(
        address indexed token,
        uint256 collected0,
        uint256 collected1,
        uint256 reinvested0,
        uint256 reinvested1,
        uint128 liquidityAdded
    );
    event TaxCompounded(
        address indexed token, uint256 tokensAdded, uint256 pairAdded, uint128 liquidityAdded
    );

    constructor(address launchpad_) {
        launchpad = launchpad_;
    }

    function register(
        address token,
        address pool,
        address creator,
        uint16 reinvestBps,
        int24 tickLower,
        int24 tickUpper
    ) external {
        require(msg.sender == launchpad, "Locker: not launchpad");
        require(locks[token].pool == address(0), "Locker: already locked");
        require(reinvestBps < BPS, "Locker: bad reinvest bps");
        locks[token] =
            Lock({pool: pool, creator: creator, reinvestBps: reinvestBps, tickLower: tickLower, tickUpper: tickUpper});
        emit PositionLocked(token, pool, reinvestBps, tickLower, tickUpper);
    }

    /// @notice Collect the locked position's accrued swap fees for `token` and
    /// route them per the token's policy. Callable by anyone. For Super LP
    /// tokens the buy-tax balance sitting on this contract joins the reinvest
    /// budget, so calling collect also compounds the tax into liquidity.
    ///
    /// Budget accounting: the launch-token side may persist on this contract
    /// between collects (the balance is unique to that token, so tax and
    /// unspent reinvest budget safely accumulate). The paired side (USDT0) is
    /// shared across every lock, so it is always flushed within the same call:
    /// whatever the reinvest doesn't spend is paid out immediately.
    function collect(address token) external nonReentrant {
        Lock memory lock = locks[token];
        require(lock.pool != address(0), "Locker: unknown token");
        IUniswapV3PoolMin pool = IUniswapV3PoolMin(lock.pool);

        // Super LP: compound accumulated buy tax into locked liquidity first,
        // while the token balance on this contract is still purely tax.
        if (IStableTokenTax(token).buyTaxBps() > 0) {
            _compoundTax(token, lock, pool);
        }

        // Poke the position so fees owed are up to date, then pull them here.
        pool.burn(lock.tickLower, lock.tickUpper, 0);
        (uint128 collected0, uint128 collected1) =
            pool.collect(address(this), lock.tickLower, lock.tickUpper, type(uint128).max, type(uint128).max);

        bool tokenIs0 = token == pool.token0();

        uint256 payoutTok;
        uint256 spent0;
        uint256 spent1;
        uint128 liquidityAdded;
        {
            // Launch-token side: everything on the contract except this
            // collect's payout share is reinvest budget (tax + leftovers).
            payoutTok = (tokenIs0 ? uint256(collected0) : uint256(collected1)) * (BPS - lock.reinvestBps) / BPS;
            uint256 budgetTok = IERC20Min(token).balanceOf(address(this)) - payoutTok;
            // Paired side: only this collect's reinvest share, never the balance.
            uint256 budgetPair = (tokenIs0 ? uint256(collected1) : uint256(collected0)) * lock.reinvestBps / BPS;
            if (lock.reinvestBps > 0 && (budgetTok > 0 || budgetPair > 0)) {
                (spent0, spent1, liquidityAdded) = _reinvest(
                    pool, lock, tokenIs0 ? budgetTok : budgetPair, tokenIs0 ? budgetPair : budgetTok
                );
            }
        }

        // Flush the paired side completely: payout share + unspent reinvest share.
        uint256 payoutPair =
            (tokenIs0 ? uint256(collected1) : uint256(collected0)) - (tokenIs0 ? spent1 : spent0);

        // Rewards leave as dollars: the token-side payout is sold into the
        // pool here (price-move capped), so the sale originates from the
        // locker — never from the claimer's wallet. Whatever the cap leaves
        // unsold is paid out in tokens instead of lingering on the contract.
        if (payoutTok > 0) {
            (uint256 pairGained, uint256 unsold) = _sellPayout(token, pool, tokenIs0, payoutTok);
            payoutPair += pairGained;
            payoutTok = unsold;
        }

        if (payoutTok == 0 && payoutPair == 0 && liquidityAdded == 0) return;

        _payout(token, payoutTok, lock.creator);
        _payout(tokenIs0 ? pool.token1() : pool.token0(), payoutPair, lock.creator);

        emit FeesCollected(token, collected0, collected1, spent0, spent1, liquidityAdded);
    }

    /// @dev Swap-and-liquify the buy-tax balance: sell half for USDT0 (bounded
    /// price impact per crank), pair the halves, and mint them into the locked
    /// position. Unsold/unpaired remainders simply wait for the next crank.
    function _compoundTax(address token, Lock memory lock, IUniswapV3PoolMin pool) private {
        uint256 taxBal = IERC20Min(token).balanceOf(address(this));
        if (taxBal < MIN_COMPOUND_TOKENS) return;

        bool tokenIs0 = token == pool.token0();
        address pairAsset = tokenIs0 ? pool.token1() : pool.token0();
        uint256 pairBefore = IERC20Min(pairAsset).balanceOf(address(this));

        {
            // Selling the token moves price away from it; cap the move.
            (uint160 sqrtP,,,,,,) = pool.slot0();
            uint160 limit = tokenIs0
                ? uint160(uint256(sqrtP) * (BPS - COMPOUND_SQRT_LIMIT_BPS) / BPS)
                : uint160(uint256(sqrtP) * (BPS + COMPOUND_SQRT_LIMIT_BPS) / BPS);
            _pendingPool = address(pool);
            // A sell can legitimately fail (e.g. price already pinned at the
            // limit); the tax just waits for the next crank in that case.
            try pool.swap(
                address(this),
                tokenIs0,
                int256(taxBal / 2),
                limit,
                abi.encode(pool.token0(), pool.token1())
            ) returns (int256, int256) {} catch {}
            _pendingPool = address(0);
        }

        // Pair whatever USDT0 the sell yielded with the remaining tax tokens.
        uint256 pairGained = IERC20Min(pairAsset).balanceOf(address(this)) - pairBefore;
        if (pairGained == 0) return;
        uint256 tokenLeft = IERC20Min(token).balanceOf(address(this));
        (uint256 spent0, uint256 spent1, uint128 added) = _reinvest(
            pool,
            lock,
            tokenIs0 ? tokenLeft : pairGained,
            tokenIs0 ? pairGained : tokenLeft
        );
        emit TaxCompounded(token, tokenIs0 ? spent0 : spent1, tokenIs0 ? spent1 : spent0, added);
    }

    function _reinvest(IUniswapV3PoolMin pool, Lock memory lock, uint256 budget0, uint256 budget1)
        private
        returns (uint256 spent0, uint256 spent1, uint128 liquidityAdded)
    {
        {
            (uint160 sqrtP,,,,,,) = pool.slot0();
            liquidityAdded = LiquidityAmounts.getLiquidityForAmounts(
                sqrtP,
                TickMath.getSqrtRatioAtTick(lock.tickLower),
                TickMath.getSqrtRatioAtTick(lock.tickUpper),
                budget0,
                budget1
            );
        }
        if (liquidityAdded == 0) return (0, 0, 0);

        address token0 = pool.token0();
        address token1 = pool.token1();

        // Reuse the return slots as before-balances to stay within stack depth.
        spent0 = IERC20Min(token0).balanceOf(address(this));
        spent1 = IERC20Min(token1).balanceOf(address(this));

        _pendingPool = address(pool);
        pool.mint(address(this), lock.tickLower, lock.tickUpper, liquidityAdded, abi.encode(token0, token1));
        _pendingPool = address(0);

        spent0 = spent0 - IERC20Min(token0).balanceOf(address(this));
        spent1 = spent1 - IERC20Min(token1).balanceOf(address(this));
    }

    /// @dev Sells the payout token share for the paired asset (USDT0) with the
    /// same per-call price-move cap as tax compounding. Partial fills are fine:
    /// the pool stops at the limit and the remainder returns as `unsold`.
    function _sellPayout(address token, IUniswapV3PoolMin pool, bool tokenIs0, uint256 amount)
        private
        returns (uint256 pairGained, uint256 unsold)
    {
        address pairAsset = tokenIs0 ? pool.token1() : pool.token0();
        // Reuse the return slots as before-balances to stay within stack depth.
        pairGained = IERC20Min(pairAsset).balanceOf(address(this));
        unsold = IERC20Min(token).balanceOf(address(this));

        {
            (uint160 sqrtP,,,,,,) = pool.slot0();
            uint160 limit = tokenIs0
                ? uint160(uint256(sqrtP) * (BPS - COMPOUND_SQRT_LIMIT_BPS) / BPS)
                : uint160(uint256(sqrtP) * (BPS + COMPOUND_SQRT_LIMIT_BPS) / BPS);
            bytes memory data = abi.encode(pool.token0(), pool.token1());
            _pendingPool = address(pool);
            // A sell can legitimately fail (price already pinned at the
            // limit); the share simply pays out as tokens in that case.
            try pool.swap(address(this), tokenIs0, int256(amount), limit, data) returns (
                int256, int256
            ) {} catch {}
            _pendingPool = address(0);
        }

        pairGained = IERC20Min(pairAsset).balanceOf(address(this)) - pairGained;
        unsold = amount - (unsold - IERC20Min(token).balanceOf(address(this)));
    }

    function _payout(address asset, uint256 amount, address creator) private {
        if (amount == 0) return;
        uint256 bal = IERC20Min(asset).balanceOf(address(this));
        if (amount > bal) amount = bal;
        uint256 creatorShare = amount * CREATOR_SHARE_BPS / BPS;
        if (creatorShare > 0) {
            IERC20Min(asset).transfer(creator, creatorShare);
        }
        uint256 platformShare = amount - creatorShare;
        if (platformShare > 0) {
            IERC20Min(asset).transfer(IStableLaunchpadFees(launchpad).feeRecipient(), platformShare);
        }
    }

    function uniswapV3MintCallback(uint256 amount0Owed, uint256 amount1Owed, bytes calldata data)
        external
    {
        require(msg.sender == _pendingPool, "Locker: bad callback");
        (address token0, address token1) = abi.decode(data, (address, address));
        if (amount0Owed > 0) IERC20Min(token0).transfer(msg.sender, amount0Owed);
        if (amount1Owed > 0) IERC20Min(token1).transfer(msg.sender, amount1Owed);
    }

    /// @dev Pays the input side of the tax-compounding sell.
    function uniswapV3SwapCallback(int256 amount0Delta, int256 amount1Delta, bytes calldata data)
        external
    {
        require(msg.sender == _pendingPool, "Locker: bad callback");
        (address token0, address token1) = abi.decode(data, (address, address));
        if (amount0Delta > 0) IERC20Min(token0).transfer(msg.sender, uint256(amount0Delta));
        if (amount1Delta > 0) IERC20Min(token1).transfer(msg.sender, uint256(amount1Delta));
    }

    /// @notice Position key of a locked token's position, for off-chain inspection.
    function positionKey(address token) external view returns (bytes32) {
        Lock memory lock = locks[token];
        return keccak256(abi.encodePacked(address(this), lock.tickLower, lock.tickUpper));
    }
}
