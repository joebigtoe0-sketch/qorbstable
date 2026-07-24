// E2E for the reward flow on the fresh local stack: launch, trade both ways,
// collect — assert the creator gains USDT0 only (zero coins) and the token
// sale originated from the locker. Run from stablepad/: node scripts/collect-e2e.mjs
import {
  createPublicClient,
  createWalletClient,
  decodeEventLog,
  formatUnits,
  http,
  parseAbi,
  parseEther,
  parseUnits,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { foundry } from "viem/chains";

const RPC = "http://127.0.0.1:8545";
const LAUNCHPAD = "0x4ed7c70F96B99c776995fB64377f0d4aB3B0e1C1";
const ROUTER = "0x322813Fd9A801c5507c9de605d63CEA4f2CE6c44";
const USDT0 = "0xc6e7DF5E7b4f2A278906862b61205850344D4e7d";

const erc20 = parseAbi([
  "function approve(address, uint256) returns (bool)",
  "function balanceOf(address) view returns (uint256)",
]);
const launchpadAbi = parseAbi([
  "function launchToken(string, string, string, uint8, bytes32, uint256, uint256) returns (address)",
  "function locker() view returns (address)",
  "event TokenLaunched(address indexed token, address indexed creator, address pool, uint8 flavor, uint256 devBuyUsd, uint256 devBuyTokens)",
]);
const routerAbi = parseAbi([
  "function buyExactUsd(address, uint24, uint256, uint256, address) returns (uint256)",
  "function sellExactTokens(address, uint24, uint256, uint256, address) returns (uint256)",
]);
const lockerAbi = parseAbi(["function collect(address)"]);

const pub = createPublicClient({ chain: foundry, transport: http(RPC) });
const wallet = (k) =>
  createWalletClient({ account: privateKeyToAccount(k), chain: foundry, transport: http(RPC) });
const creator = wallet("0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80");
const alice = wallet("0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d");

async function send(w, req) {
  const hash = await w.writeContract(req);
  const r = await pub.waitForTransactionReceipt({ hash });
  if (r.status !== "success") throw new Error(`revert: ${req.functionName}`);
  return r;
}
const warp = async (s) => {
  await pub.request({ method: "evm_increaseTime", params: [s] });
  await pub.request({ method: "evm_mine", params: [] });
};

// Launch
const salt = `0x${crypto.getRandomValues(new Uint8Array(32)).reduce((s, b) => s + b.toString(16).padStart(2, "0"), "")}`;
const launchReceipt = await send(creator, {
  address: LAUNCHPAD, abi: launchpadAbi, functionName: "launchToken",
  args: ["Reward Test", "RWRD", "", 0, salt, 0n, 0n],
});
let token, pool;
for (const log of launchReceipt.logs) {
  try {
    const d = decodeEventLog({ abi: launchpadAbi, data: log.data, topics: log.topics });
    if (d.eventName === "TokenLaunched") ({ token, pool } = d.args);
  } catch {}
}
console.log(`launched RWRD ${token}`);
await warp(130);

// Trade both directions so fees accrue on BOTH sides
await send(alice, { address: USDT0, abi: erc20, functionName: "approve", args: [ROUTER, parseUnits("3000", 6)] });
await send(alice, { address: ROUTER, abi: routerAbi, functionName: "buyExactUsd", args: [token, 10000, parseUnits("2000", 6), 0n, alice.account.address] });
const aliceBal = await pub.readContract({ address: token, abi: erc20, functionName: "balanceOf", args: [alice.account.address] });
await send(alice, { address: token, abi: erc20, functionName: "approve", args: [ROUTER, aliceBal / 2n] });
await send(alice, { address: ROUTER, abi: routerAbi, functionName: "sellExactTokens", args: [token, 10000, aliceBal / 2n, 0n, alice.account.address] });
console.log("traded: $2000 buy + 50% sell (fees on both sides)");

// Collect — permissionless; alice cranks it, creator gets paid
const locker = await pub.readContract({ address: LAUNCHPAD, abi: launchpadAbi, functionName: "locker" });
const creatorUsdBefore = await pub.readContract({ address: USDT0, abi: erc20, functionName: "balanceOf", args: [creator.account.address] });
const creatorTokBefore = await pub.readContract({ address: token, abi: erc20, functionName: "balanceOf", args: [creator.account.address] });

const collectReceipt = await send(alice, { address: locker, abi: lockerAbi, functionName: "collect", args: [token] });

const creatorUsdGain = (await pub.readContract({ address: USDT0, abi: erc20, functionName: "balanceOf", args: [creator.account.address] })) - creatorUsdBefore;
const creatorTokGain = (await pub.readContract({ address: token, abi: erc20, functionName: "balanceOf", args: [creator.account.address] })) - creatorTokBefore;
const lockerTokLeft = await pub.readContract({ address: token, abi: erc20, functionName: "balanceOf", args: [locker] });

// The in-collect sale shows as a pool Swap with recipient = locker
const swapEvt = parseAbi(["event Swap(address indexed sender, address indexed recipient, int256 amount0, int256 amount1, uint160 sqrtPriceX96, uint128 liquidity, int24 tick)"]);
let lockerSell = false;
for (const log of collectReceipt.logs) {
  try {
    const d = decodeEventLog({ abi: swapEvt, data: log.data, topics: log.topics });
    if (d.eventName === "Swap" && d.args.recipient.toLowerCase() === locker.toLowerCase()) lockerSell = true;
  } catch {}
}

console.log(`creator USDT0 gain: $${formatUnits(creatorUsdGain, 6)}`);
console.log(`creator token gain: ${creatorTokGain} (must be 0)`);
console.log(`locker token dust left: ${lockerTokLeft}`);
console.log(`in-collect sale attributed to locker: ${lockerSell}`);

if (creatorTokGain !== 0n) throw new Error("creator received coins!");
if (creatorUsdGain <= 0n) throw new Error("creator got no USDT0!");
if (!lockerSell) throw new Error("no locker-attributed sale found!");
if (lockerTokLeft >= parseEther("1")) throw new Error("token-side fees not fully sold");
console.log("collect e2e PASSED");
