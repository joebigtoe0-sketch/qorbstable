// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {StableLaunchpad} from "../src/StableLaunchpad.sol";
import {StableRouter} from "../src/StableRouter.sol";

/// @notice Deploys the launchpad (and its locker) + router against the
/// canonical Uniswap v3 factory and ERC20 USDT0 on Stable Chain.
///
/// Stable mainnet (chain 988):
///   UNIV3_FACTORY = 0x88F0a512eF09175D456bc9547f914f48C013E4aA
///   USDT0         = 0x779ded0c9e1022225f8e0630b35a9b54be713736 (6 decimals)
///
/// Usage:
///   UNIV3_FACTORY=0x... USDT0=0x... FEE_RECIPIENT=0x... \
///   forge script script/Deploy.s.sol --rpc-url stable --broadcast \
///     --private-key $DEPLOYER_KEY
contract DeployLaunchpad is Script {
    function run() external returns (StableLaunchpad launchpad, StableRouter router) {
        address uniV3Factory =
            vm.envOr("UNIV3_FACTORY", address(0x88F0a512eF09175D456bc9547f914f48C013E4aA));
        address usdt0 =
            vm.envOr("USDT0", address(0x779Ded0c9e1022225f8E0630b35a9b54bE713736));
        address feeRecipient = vm.envAddress("FEE_RECIPIENT");

        vm.startBroadcast();
        launchpad = new StableLaunchpad(uniV3Factory, usdt0, feeRecipient);
        router = new StableRouter(uniV3Factory, usdt0);
        vm.stopBroadcast();

        console.log("StableLaunchpad:", address(launchpad));
        console.log("StableLocker:   ", address(launchpad.locker()));
        console.log("StableRouter:   ", address(router));
    }
}
