// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ReentrancyGuard} from "./base/ReentrancyGuard.sol";
import {IERC20Min, IUniswapV3FactoryMin, IUniswapV3PoolMin} from "./interfaces/IExternal.sol";

/**
 * @title StableRouter
 * @notice Minimal USDT0 <-> token router for The Stable's Uniswap v3 pools
 * (core only, no periphery dependency). Buys pull USDT0 via transferFrom and
 * swap; sells swap and pay USDT0 out. Both return amountOut so the UI can
 * quote via eth_call simulation. Stateless between calls; never holds user
 * funds beyond a transaction.
 *
 * Buys measure what the recipient actually receives — for Super LP tokens the
 * buy tax is skimmed between the pool and the buyer, so the pool's swap delta
 * overstates the delivered amount.
 */
contract StableRouter is ReentrancyGuard {
    uint160 private constant MIN_SQRT_RATIO = 4295128739;
    uint160 private constant MAX_SQRT_RATIO = 1461446703485210103287273052203988822378723970342;

    IUniswapV3FactoryMin public immutable uniswapFactory;
    IERC20Min public immutable usdt0;

    address private _pendingPool;

    constructor(address uniswapFactory_, address usdt0_) {
        require(uniswapFactory_ != address(0) && usdt0_ != address(0), "Router: zero address");
        uniswapFactory = IUniswapV3FactoryMin(uniswapFactory_);
        usdt0 = IERC20Min(usdt0_);
    }

    /// @notice Swap exact `usdIn` USDT0 (caller must approve) for `token`,
    /// delivered to `recipient`.
    function buyExactUsd(
        address token,
        uint24 fee,
        uint256 usdIn,
        uint256 minTokensOut,
        address recipient
    ) external nonReentrant returns (uint256 tokensOut) {
        require(usdIn > 0, "Router: zero input");
        IUniswapV3PoolMin pool = _poolOf(token, fee);
        require(usdt0.transferFrom(msg.sender, address(this), usdIn), "Router: usdt0 pull");

        uint256 before = IERC20Min(token).balanceOf(recipient);

        bool zeroForOne = address(usdt0) < token; // USDT0 in
        _pendingPool = address(pool);
        pool.swap(
            recipient,
            zeroForOne,
            int256(usdIn),
            zeroForOne ? MIN_SQRT_RATIO + 1 : MAX_SQRT_RATIO - 1,
            ""
        );
        _pendingPool = address(0);

        tokensOut = IERC20Min(token).balanceOf(recipient) - before;
        require(tokensOut >= minTokensOut, "Router: slippage");
    }

    /// @notice Swap exact `amountIn` of `token` (caller must approve) for USDT0.
    function sellExactTokens(
        address token,
        uint24 fee,
        uint256 amountIn,
        uint256 minUsdOut,
        address recipient
    ) external nonReentrant returns (uint256 usdOut) {
        require(amountIn > 0, "Router: zero input");
        IUniswapV3PoolMin pool = _poolOf(token, fee);
        require(
            IERC20Min(token).transferFrom(msg.sender, address(this), amountIn),
            "Router: token pull"
        );

        bool zeroForOne = token < address(usdt0); // token in
        _pendingPool = address(pool);
        (int256 amount0, int256 amount1) = pool.swap(
            address(this),
            zeroForOne,
            int256(amountIn),
            zeroForOne ? MIN_SQRT_RATIO + 1 : MAX_SQRT_RATIO - 1,
            ""
        );
        _pendingPool = address(0);

        usdOut = uint256(-(zeroForOne ? amount1 : amount0));
        require(usdOut >= minUsdOut, "Router: slippage");
        require(usdt0.transfer(recipient, usdOut), "Router: usdt0 send");
    }

    function uniswapV3SwapCallback(int256 amount0Delta, int256 amount1Delta, bytes calldata)
        external
    {
        require(msg.sender == _pendingPool, "Router: bad callback");
        IUniswapV3PoolMin pool = IUniswapV3PoolMin(msg.sender);
        if (amount0Delta > 0) {
            IERC20Min(pool.token0()).transfer(msg.sender, uint256(amount0Delta));
        }
        if (amount1Delta > 0) {
            IERC20Min(pool.token1()).transfer(msg.sender, uint256(amount1Delta));
        }
    }

    function _poolOf(address token, uint24 fee) private view returns (IUniswapV3PoolMin) {
        address pool = uniswapFactory.getPool(token, address(usdt0), fee);
        require(pool != address(0), "Router: no pool");
        return IUniswapV3PoolMin(pool);
    }
}
