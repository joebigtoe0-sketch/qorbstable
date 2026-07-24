// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {StableLaunchpad} from "../src/StableLaunchpad.sol";
import {StableRouter} from "../src/StableRouter.sol";
import {USDT0Mock} from "../test/mocks/USDT0Mock.sol";

/// @notice Full local stack: USDT0 mock (6 decimals, open mint), real Uniswap
/// v3 factory (vendored bytecode), launchpad (deploys its own locker), router.
///
///   anvil                                   # terminal 1
///   npm run evm:local                       # terminal 2 (from stablepad/)
contract DeployLocalStack is Script {
    function run() external {
        vm.startBroadcast();

        USDT0Mock usdt0 = new USDT0Mock();
        address factory = _create(vm.getCode("UniswapV3Factory.sol:UniswapV3Factory"), "");
        StableLaunchpad launchpad = new StableLaunchpad(factory, address(usdt0), msg.sender);
        StableRouter router = new StableRouter(factory, address(usdt0));

        // Fund the default anvil accounts with $1M USDT0 each for local play.
        address[10] memory anvil = [
            0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266,
            0x70997970C51812dc3A010C7d01b50e0d17dc79C8,
            0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC,
            0x90F79bf6EB2c4f870365E785982E1f101E93b906,
            0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65,
            0x9965507D1a55bcC2695C58ba16FB37d819B0A4dc,
            0x976EA74026E726554dB657fA54763abd0C3a0aa9,
            0x14dC79964da2C08b23698B3D3cc7Ca32193d9955,
            0x23618e81E3f5cdF7f54C3d65f7FBc0aBf5B21E8f,
            0xa0Ee7A142d267C1f36714E4a8F75612F20a79720
        ];
        for (uint256 i = 0; i < anvil.length; i++) {
            usdt0.mint(anvil[i], 1_000_000e6);
        }

        vm.stopBroadcast();

        console.log("USDT0Mock:        ", address(usdt0));
        console.log("UniswapV3Factory: ", factory);
        console.log("StableLaunchpad:  ", address(launchpad));
        console.log("StableLocker:     ", address(launchpad.locker()));
        console.log("StableRouter:     ", address(router));
        console.log("");
        console.log("NEXT_PUBLIC_LAUNCHPAD_ADDRESS=%s", address(launchpad));
        console.log("NEXT_PUBLIC_ROUTER_ADDRESS=%s", address(router));
        console.log("NEXT_PUBLIC_USDT0_ADDRESS=%s", address(usdt0));
    }

    function _create(bytes memory code, bytes memory args) private returns (address addr) {
        bytes memory bytecode = abi.encodePacked(code, args);
        assembly {
            addr := create(0, add(bytecode, 0x20), mload(bytecode))
        }
        require(addr != address(0), "create failed");
    }
}
