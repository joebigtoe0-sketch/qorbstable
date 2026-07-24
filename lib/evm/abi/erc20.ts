import { parseAbi } from "viem";

/** Minimal ERC20 surface — used for USDT0 (6 decimals) approve/balance flows. */
export const erc20Abi = parseAbi([
  "function balanceOf(address owner) view returns (uint256)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function approve(address spender, uint256 value) returns (bool)",
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)",
]);
