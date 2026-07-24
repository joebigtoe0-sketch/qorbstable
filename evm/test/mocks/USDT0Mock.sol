// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice 6-decimal USDT0 stand-in for tests/local dev — mirrors the ERC20
/// interface of Stable Chain's canonical USDT0 (StableOFTExtension proxy at
/// 0x779ded0c9e1022225f8e0630b35a9b54be713736). Open mint for funding test
/// accounts.
contract USDT0Mock {
    string public constant name = "USDT0";
    string public constant symbol = "USDT0";
    uint8 public constant decimals = 6;

    uint256 public totalSupply;
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);

    function mint(address to, uint256 value) external {
        totalSupply += value;
        balanceOf[to] += value;
        emit Transfer(address(0), to, value);
    }

    function approve(address spender, uint256 value) external returns (bool) {
        allowance[msg.sender][spender] = value;
        emit Approval(msg.sender, spender, value);
        return true;
    }

    function transfer(address to, uint256 value) external returns (bool) {
        return _transferFrom(msg.sender, to, value);
    }

    function transferFrom(address from, address to, uint256 value) external returns (bool) {
        if (from != msg.sender && allowance[from][msg.sender] != type(uint256).max) {
            require(allowance[from][msg.sender] >= value, "USDT0: allowance");
            allowance[from][msg.sender] -= value;
        }
        return _transferFrom(from, to, value);
    }

    function _transferFrom(address from, address to, uint256 value) private returns (bool) {
        require(balanceOf[from] >= value, "USDT0: balance");
        balanceOf[from] -= value;
        balanceOf[to] += value;
        emit Transfer(from, to, value);
        return true;
    }
}
