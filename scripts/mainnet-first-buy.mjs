// $1 smoke buy of FIRST through the mainnet router — proves real USDT0
// transferFrom + pool swap, and gives DEXScreener its first trade to index.
import { createPublicClient, createWalletClient, defineChain, formatEther, http, parseAbi, parseUnits } from "viem";
import { privateKeyToAccount } from "viem/accounts";

const ROUTER = "0x1CcB2F4c6dA5EB448c2ef84EF235919f7270C646";
const USDT0 = "0x779Ded0c9e1022225f8E0630b35a9b54bE713736";
const TOKEN = "0x9A0cf14A288c2Fa34354403c4a775Eb816BA5B1E";
const KEY = "0x861c39cee47697d38c3bfb37f21385b21a42610bdf089cf542f6b75d343a13a8";

const stable = defineChain({
  id: 988, name: "Stable",
  nativeCurrency: { name: "USDT0", symbol: "USDT0", decimals: 18 },
  rpcUrls: { default: { http: ["https://rpc.stable.xyz"] } },
});
const account = privateKeyToAccount(KEY);
const pub = createPublicClient({ chain: stable, transport: http() });
const wallet = createWalletClient({ account, chain: stable, transport: http() });

const erc20 = parseAbi(["function approve(address, uint256) returns (bool)", "function balanceOf(address) view returns (uint256)"]);
const routerAbi = parseAbi(["function buyExactUsd(address, uint24, uint256, uint256, address) returns (uint256)"]);

let hash = await wallet.writeContract({ address: USDT0, abi: erc20, functionName: "approve", args: [ROUTER, parseUnits("1", 6)] });
await pub.waitForTransactionReceipt({ hash });
console.log("approved");

hash = await wallet.writeContract({
  address: ROUTER, abi: routerAbi, functionName: "buyExactUsd",
  args: [TOKEN, 10000, parseUnits("1", 6), 0n, account.address],
});
const r = await pub.waitForTransactionReceipt({ hash });
console.log("buy status:", r.status, "tx:", hash);
const bal = await pub.readContract({ address: TOKEN, abi: erc20, functionName: "balanceOf", args: [account.address] });
console.log("FIRST received:", Number(formatEther(bal)).toLocaleString());
