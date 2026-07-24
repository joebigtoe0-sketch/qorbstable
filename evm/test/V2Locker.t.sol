// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {BaseSetup} from "./BaseSetup.sol";
import {StableLaunchpad} from "../src/StableLaunchpad.sol";
import {StableLaunchToken} from "../src/tokens/StableLaunchToken.sol";

contract V2LockerTest is BaseSetup {
    function test_Standard_CollectSplitsFeesFiftyFifty() public {
        address token = _launch(StableLaunchpad.Flavor.Standard);
        _buy(token, 2_000e6, alice);
        _sell(token, StableLaunchToken(token).balanceOf(alice) / 2, alice);

        uint256 creatorWethBefore = usdt0.balanceOf(creator);
        uint256 platformWethBefore = usdt0.balanceOf(platform);
        uint128 liqBefore = _positionLiquidity(token);

        locker.collect(token);

        uint256 creatorGain = usdt0.balanceOf(creator) - creatorWethBefore;
        uint256 platformGain = usdt0.balanceOf(platform) - platformWethBefore;
        assertGt(creatorGain, 0, "creator earns USDT0 fees");
        assertApproxEqAbs(creatorGain, platformGain, 2, "50/50 split");
        assertEq(_positionLiquidity(token), liqBefore, "Standard never reinvests");
    }

    function test_Standard_TokenSideRewardsAutoSoldToUsdt0() public {
        address token = _launch(StableLaunchpad.Flavor.Standard);
        _buy(token, 2_000e6, alice);
        // Sells accrue token-side fees — the side that used to pay out in coins.
        _sell(token, StableLaunchToken(token).balanceOf(alice) / 2, alice);

        uint256 creatorTokBefore = StableLaunchToken(token).balanceOf(creator);
        uint256 platformTokBefore = StableLaunchToken(token).balanceOf(platform);
        uint256 creatorUsdBefore = usdt0.balanceOf(creator);

        locker.collect(token);

        assertEq(
            StableLaunchToken(token).balanceOf(creator),
            creatorTokBefore,
            "creator never receives coins"
        );
        assertEq(
            StableLaunchToken(token).balanceOf(platform),
            platformTokBefore,
            "platform never receives coins"
        );
        assertLt(
            StableLaunchToken(token).balanceOf(address(locker)),
            1e18,
            "token-side fees fully sold (dust only)"
        );
        assertGt(usdt0.balanceOf(creator) - creatorUsdBefore, 0, "rewards arrive as USDT0");
    }

    function test_LPGrow_CollectReinvestsSeventyPercent() public {
        address token = _launch(StableLaunchpad.Flavor.LPGrow);
        _buy(token, 2_000e6, alice);
        _sell(token, StableLaunchToken(token).balanceOf(alice) / 2, alice);

        uint128 liqBefore = _positionLiquidity(token);
        uint256 creatorWethBefore = usdt0.balanceOf(creator);

        locker.collect(token);

        assertGt(_positionLiquidity(token), liqBefore, "liquidity deepened");
        assertGt(usdt0.balanceOf(creator), creatorWethBefore, "creator still paid the payout share");
    }

    function test_SuperLP_BuyTaxLandsOnLockerAndCompounds() public {
        address token = _launch(StableLaunchpad.Flavor.SuperLP);

        uint256 out = _buy(token, 2_000e6, alice);
        uint256 taxHeld = StableLaunchToken(token).balanceOf(address(locker));
        // Tax is 5% of the gross pool output; alice got the other 95%.
        assertApproxEqRel(taxHeld, out * 500 / 9500, 1e15, "5% buy tax skimmed to locker");

        // collect() swap-and-liquifies the tax: half sold for USDT0, paired,
        // minted into the locked position — no sells or fees required.
        uint128 liqBefore = _positionLiquidity(token);
        locker.collect(token);
        assertGt(_positionLiquidity(token), liqBefore, "tax compounds into locked LP");
        assertLt(
            StableLaunchToken(token).balanceOf(address(locker)),
            taxHeld,
            "tax balance consumed by compounding"
        );
    }

    function test_SuperLP_PoolFeesStillSplitFiftyFifty() public {
        address token = _launch(StableLaunchpad.Flavor.SuperLP);
        _buy(token, 2_000e6, alice);
        _sell(token, StableLaunchToken(token).balanceOf(alice) / 2, alice);

        uint256 creatorWethBefore = usdt0.balanceOf(creator);
        uint256 platformWethBefore = usdt0.balanceOf(platform);

        locker.collect(token);

        uint256 creatorGain = usdt0.balanceOf(creator) - creatorWethBefore;
        uint256 platformGain = usdt0.balanceOf(platform) - platformWethBefore;
        assertGt(creatorGain, 0, "creator earns USDT0 fees");
        assertApproxEqAbs(creatorGain, platformGain, 2, "fees split 50/50, tax handled separately");
    }

    function test_SuperLP_SellsAreNeverTaxed() public {
        address token = _launch(StableLaunchpad.Flavor.SuperLP);
        uint256 out = _buy(token, 1_000e6, alice);

        uint256 lockerBefore = StableLaunchToken(token).balanceOf(address(locker));
        _sell(token, out / 2, alice);
        assertEq(
            StableLaunchToken(token).balanceOf(address(locker)),
            lockerBefore,
            "sell moved no tax to the locker"
        );
    }

    function test_Collect_PermissionlessAndIdempotent() public {
        address token = _launch(StableLaunchpad.Flavor.Standard);
        _buy(token, 1_000e6, alice);

        vm.prank(bob); // anyone can crank
        locker.collect(token);

        // Nothing accrued since — second collect is a harmless no-op.
        uint256 creatorWeth = usdt0.balanceOf(creator);
        locker.collect(token);
        assertEq(usdt0.balanceOf(creator), creatorWeth, "no double payout");
    }

    function test_Locker_HasNoWithdrawPath() public {
        address token = _launch(StableLaunchpad.Flavor.Standard);
        uint128 liq = _positionLiquidity(token);
        assertGt(liq, 0);
        // The locker exposes register/collect/positionKey/locks only — nothing
        // can decrease liquidity. Compile-time guarantee; assert the position
        // persists after a full trading + collect cycle.
        _buy(token, 1_000e6, alice);
        _sell(token, StableLaunchToken(token).balanceOf(alice), alice);
        locker.collect(token);
        assertGe(_positionLiquidity(token), liq, "locked liquidity never decreases");
    }

    function test_Register_OnlyLaunchpad() public {
        vm.expectRevert(bytes("Locker: not launchpad"));
        vm.prank(attacker);
        locker.register(makeAddr("fakeToken"), makeAddr("fakePool"), attacker, 0, -100, 100);
    }
}
