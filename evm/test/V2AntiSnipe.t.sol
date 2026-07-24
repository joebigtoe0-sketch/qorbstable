// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {BaseSetup} from "./BaseSetup.sol";
import {StableLaunchpad} from "../src/StableLaunchpad.sol";
import {StableLaunchToken} from "../src/tokens/StableLaunchToken.sol";

contract V2AntiSnipeTest is BaseSetup {
    function test_LaunchBlockBuyBlocked() public {
        address token = _launchNoWarp(StableLaunchpad.Flavor.Standard, 0);
        address pool = _pool(token);
        bool usdIsToken0 = address(usdt0) < token;

        usdt0.mint(address(router), 10e6);
        vm.expectRevert(); // LaunchBlockBuyBlocked bubbles through the pool
        router.swapExactInput(pool, usdIsToken0, 10e6, attacker);
    }

    function test_WindowCapsCumulativeBuysPerWallet() public {
        address token = _launchNoWarp(StableLaunchpad.Flavor.Standard, 0);
        vm.roll(block.number + 1); // past the launch block, still in the window

        // ~$60 buys ~15M tokens (under the 20M cap) — fine.
        uint256 got = _buy(token, 60e6, attacker);
        assertGt(got, 0);

        // The next buy pushes the wallet's cumulative window total past 2%.
        address pool = _pool(token);
        bool usdIsToken0 = address(usdt0) < token;
        usdt0.mint(address(router), 30e6);
        vm.expectRevert(); // LaunchWindowMaxBuy bubbles through the pool
        router.swapExactInput(pool, usdIsToken0, 30e6, attacker);

        // A different wallet still has its own allowance.
        uint256 gotBob = _buy(token, 60e6, bob);
        assertGt(gotBob, 0);
    }

    function test_WindowLiftsAfterExpiry() public {
        address token = _launchNoWarp(StableLaunchpad.Flavor.Standard, 0);
        vm.roll(block.number + 1);
        vm.warp(block.timestamp + 121);

        uint256 got = _buy(token, 2_000e6, attacker); // way past 2% — allowed now
        uint256 cap = StableLaunchToken(token).SNIPE_MAX_TOKENS();
        assertGt(got, cap, "window over: cap no longer applies");
    }

    function test_DevBuyExemptFromLaunchBlockAndCap() public {
        // $500 dev buy is > the 2% window cap and happens in the launch block.
        address token = _launchNoWarp(StableLaunchpad.Flavor.Standard, 500e6);
        uint256 got = StableLaunchToken(token).balanceOf(creator);
        assertGt(got, StableLaunchToken(token).SNIPE_MAX_TOKENS(), "dev buy exceeds cap by design");
    }

    function test_SellsUnrestrictedDuringWindow() public {
        address token = _launchNoWarp(StableLaunchpad.Flavor.Standard, 50e6);
        vm.roll(block.number + 1); // sells only need to be off the launch block for the pool math

        uint256 creatorTokens = StableLaunchToken(token).balanceOf(creator);
        uint256 usdOut = _sell(token, creatorTokens / 2, creator);
        assertGt(usdOut, 0, "selling during the window is never restricted");
    }
}
