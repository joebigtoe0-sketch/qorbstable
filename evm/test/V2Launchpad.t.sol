// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {BaseSetup} from "./BaseSetup.sol";
import {StableLaunchpad} from "../src/StableLaunchpad.sol";
import {StableLaunchToken} from "../src/tokens/StableLaunchToken.sol";
import {IUniswapV3PoolMin} from "../src/interfaces/IExternal.sol";

contract V2LaunchpadTest is BaseSetup {
    function test_Launch_CreatesPoolWithFullSupplyLocked() public {
        address token = _launch(StableLaunchpad.Flavor.Standard);
        address pool = _pool(token);

        assertTrue(pool != address(0), "pool created");
        (uint160 sqrtP, int24 tick,,,,,) = IUniswapV3PoolMin(pool).slot0();
        assertGt(sqrtP, 0, "pool initialized");
        tick; // orientation-dependent; presence of price is what matters

        // Entire supply is either in the pool or burned dust; launchpad keeps 0.
        StableLaunchToken t = StableLaunchToken(token);
        assertEq(t.balanceOf(address(launchpad)), 0, "launchpad keeps nothing");
        assertEq(
            t.balanceOf(pool) + t.balanceOf(DEAD),
            t.TOTAL_SUPPLY(),
            "supply fully pooled or burned"
        );
        assertGt(_positionLiquidity(token), 0, "locker owns liquidity");

        (address creator_, address pool_,,,) = launchpad.launches(token);
        assertEq(creator_, creator);
        assertEq(pool_, pool);
    }

    function test_Launch_BuyThenSellRoundTrip() public {
        address token = _launch(StableLaunchpad.Flavor.Standard);

        uint256 got = _buy(token, 1_000e6, alice);
        assertGt(got, 0, "buy delivered tokens");

        uint256 usdBack = _sell(token, got, alice);
        assertGt(usdBack, 900e6, "sell returns most of the USDT0");
        assertLt(usdBack, 1_000e6, "pool fee was charged");
    }

    function test_Launch_PriceRisesWithBuys() public {
        address token = _launch(StableLaunchpad.Flavor.Standard);

        uint256 out1 = _buy(token, 1_000e6, alice);
        uint256 out2 = _buy(token, 1_000e6, bob);
        assertLt(out2, out1, "same USDT0 buys fewer tokens as price climbs");
    }

    function test_Launch_DevBuyAtomicInLaunchBlock() public {
        address token = _launchNoWarp(StableLaunchpad.Flavor.Standard, 1_000e6);
        assertGt(StableLaunchToken(token).balanceOf(creator), 0, "creator got dev buy tokens");
    }

    function test_Launch_VanityAddressIsPredictable() public {
        bytes32 salt = bytes32(uint256(0xC00));
        address predicted = launchpad.predictTokenAddress(
            "Steed Coin", "STEED", "ipfs://steed-metadata", StableLaunchpad.Flavor.LPGrow, salt, creator
        );
        vm.prank(creator);
        address token = launchpad.launchToken(
            "Steed Coin", "STEED", "ipfs://steed-metadata", StableLaunchpad.Flavor.LPGrow, salt, 0, 0
        );
        assertEq(token, predicted, "CREATE2 address matches prediction");
    }

    function test_Launch_RevertsWhenPoolPreCreated() public {
        bytes32 salt = bytes32(uint256(0xBAD));
        address predicted = launchpad.predictTokenAddress(
            "Steed Coin", "STEED", "ipfs://steed-metadata", StableLaunchpad.Flavor.Standard, salt, creator
        );
        vm.prank(attacker);
        uniFactory.createPool(predicted, address(usdt0), launchpad.POOL_FEE());

        vm.prank(creator);
        vm.expectRevert(bytes("Launchpad: pool exists"));
        launchpad.launchToken(
            "Steed Coin", "STEED", "ipfs://steed-metadata", StableLaunchpad.Flavor.Standard, salt, 0, 0
        );
    }

    function test_GraduationStatus_FlipsAtThreshold() public {
        address token = _launch(StableLaunchpad.Flavor.Standard);

        (uint256 principal0,, bool graduated0) = launchpad.graduationStatus(token);
        assertEq(principal0, 0, "starts with zero USDT0 principal");
        assertFalse(graduated0);

        _buy(token, 4_000e6, alice);
        (uint256 principal1,, bool graduated1) = launchpad.graduationStatus(token);
        assertGt(principal1, 3_900e6, "principal tracks buys");
        assertFalse(graduated1, "4k is below threshold");

        _buy(token, 9_000e6, bob);
        (uint256 principal2, uint256 threshold, bool graduated2) = launchpad.graduationStatus(token);
        assertGe(principal2, threshold, "threshold crossed");
        assertTrue(graduated2, "graduated badge on");
    }

    function test_Launch_MetadataReadableFromToken() public {
        address token = _launch(StableLaunchpad.Flavor.SuperLP);
        StableLaunchToken t = StableLaunchToken(token);
        assertEq(t.name(), "Steed Coin");
        assertEq(t.symbol(), "STEED");
        assertEq(t.metadataURI(), "ipfs://steed-metadata");
        assertEq(t.creator(), creator);
        assertEq(t.buyTaxBps(), launchpad.SUPER_LP_BUY_TAX_BPS());
    }
}
