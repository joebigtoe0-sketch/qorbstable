// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {StableLaunchpad} from "../src/StableLaunchpad.sol";
import {StableLocker} from "../src/StableLocker.sol";
import {StableLaunchToken} from "../src/tokens/StableLaunchToken.sol";
import {IUniswapV3FactoryMin, IUniswapV3PoolMin} from "../src/interfaces/IExternal.sol";
import {USDT0Mock} from "./mocks/USDT0Mock.sol";
import {TestSwapRouter} from "./utils/TestSwapRouter.sol";

abstract contract BaseSetup is Test {
    StableLaunchpad internal launchpad;
    StableLocker internal locker;
    USDT0Mock internal usdt0;
    IUniswapV3FactoryMin internal uniFactory;
    TestSwapRouter internal router;

    address internal platform = makeAddr("platform");
    address internal creator = makeAddr("creator");
    address internal alice = makeAddr("alice");
    address internal bob = makeAddr("bob");
    address internal attacker = makeAddr("attacker");

    address internal constant DEAD = 0x000000000000000000000000000000000000dEaD;
    uint256 internal saltNonce;

    function setUp() public virtual {
        usdt0 = new USDT0Mock();
        uniFactory = IUniswapV3FactoryMin(deployCode("UniswapV3Factory.sol:UniswapV3Factory"));
        launchpad = new StableLaunchpad(address(uniFactory), address(usdt0), platform);
        locker = launchpad.locker();
        router = new TestSwapRouter();

        // $1M of 6-dec USDT0 each, pre-approved to the launchpad for dev buys.
        address[5] memory users = [creator, alice, bob, attacker, address(this)];
        for (uint256 i = 0; i < users.length; i++) {
            usdt0.mint(users[i], 1_000_000e6);
            vm.prank(users[i]);
            usdt0.approve(address(launchpad), type(uint256).max);
        }
    }

    /// @dev Launches a token and warps past the anti-snipe window so ordinary
    /// tests can trade freely.
    function _launch(StableLaunchpad.Flavor flavor) internal returns (address token) {
        token = _launchNoWarp(flavor, 0);
        vm.warp(block.timestamp + 121);
        vm.roll(block.number + 1);
    }

    function _launchNoWarp(StableLaunchpad.Flavor flavor, uint256 devBuyUsd)
        internal
        returns (address token)
    {
        vm.prank(creator);
        token = launchpad.launchToken(
            "Steed Coin", "STEED", "ipfs://steed-metadata", flavor, bytes32(++saltNonce), devBuyUsd, 0
        );
    }

    function _pool(address token) internal view returns (address) {
        return uniFactory.getPool(token, address(usdt0), launchpad.POOL_FEE());
    }

    /// @dev Buys `usdIn` worth of `token` for `recipient` through the test router.
    function _buy(address token, uint256 usdIn, address recipient) internal returns (uint256 out) {
        usdt0.mint(address(router), usdIn);
        bool usdIsToken0 = address(usdt0) < token;
        uint256 before = StableLaunchToken(token).balanceOf(recipient);
        router.swapExactInput(_pool(token), usdIsToken0, usdIn, recipient);
        out = StableLaunchToken(token).balanceOf(recipient) - before;
    }

    /// @dev Sells `amount` of `seller`'s tokens for USDT0 through the test router.
    function _sell(address token, uint256 amount, address seller) internal returns (uint256 out) {
        vm.prank(seller);
        StableLaunchToken(token).transfer(address(router), amount);
        bool tokenIs0 = token < address(usdt0);
        uint256 before = usdt0.balanceOf(seller);
        router.swapExactInput(_pool(token), tokenIs0, amount, seller);
        out = usdt0.balanceOf(seller) - before;
    }

    function _positionLiquidity(address token) internal view returns (uint128 liq) {
        (liq,,,,) = IUniswapV3PoolMin(_pool(token)).positions(locker.positionKey(token));
    }
}
