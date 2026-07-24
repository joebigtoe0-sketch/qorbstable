// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {BaseSetup} from "./BaseSetup.sol";
import {StableLaunchpad} from "../src/StableLaunchpad.sol";
import {StableRouter} from "../src/StableRouter.sol";
import {StableLaunchToken} from "../src/tokens/StableLaunchToken.sol";

contract V2RouterTest is BaseSetup {
    StableRouter internal appRouter;

    function setUp() public override {
        super.setUp();
        appRouter = new StableRouter(address(uniFactory), address(usdt0));
        // Users approve the router for USDT0 buys.
        address[3] memory users = [alice, bob, attacker];
        for (uint256 i = 0; i < users.length; i++) {
            vm.prank(users[i]);
            usdt0.approve(address(appRouter), type(uint256).max);
        }
    }

    function test_Router_BuyAndSellRoundTripInUsd() public {
        address token = _launch(StableLaunchpad.Flavor.Standard);

        vm.prank(alice);
        uint256 got = appRouter.buyExactUsd(token, 10_000, 1_000e6, 0, alice);
        assertGt(got, 0, "buy delivered");
        assertEq(StableLaunchToken(token).balanceOf(alice), got, "return matches delivery");

        vm.startPrank(alice);
        StableLaunchToken(token).approve(address(appRouter), got);
        uint256 balBefore = usdt0.balanceOf(alice);
        uint256 usdOut = appRouter.sellExactTokens(token, 10_000, got, 0, alice);
        vm.stopPrank();

        assertEq(usdt0.balanceOf(alice) - balBefore, usdOut, "USDT0 delivered");
        assertGt(usdOut, 900e6, "round trip keeps most value");
    }

    function test_Router_SlippageGuards() public {
        address token = _launch(StableLaunchpad.Flavor.Standard);
        vm.prank(alice);
        vm.expectRevert(bytes("Router: slippage"));
        appRouter.buyExactUsd(token, 10_000, 100e6, type(uint256).max, alice);
    }

    function test_Router_NoPoolReverts() public {
        vm.prank(alice);
        vm.expectRevert(bytes("Router: no pool"));
        appRouter.buyExactUsd(makeAddr("noToken"), 10_000, 100e6, 0, alice);
    }
}
