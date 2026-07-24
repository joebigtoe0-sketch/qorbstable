// Local e2e against a fresh anvil + DeployLocal stack: launches coins, trades
// them through StableRouter, and pushes one over the $12k graduation line.
// Run from stablepad/:  node scripts/e2e-local.mjs
import {
  createPublicClient,
  createWalletClient,
  decodeEventLog,
  http,
  parseAbi,
  parseEther,
  parseUnits,
  formatUnits,
  formatEther,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { foundry } from "viem/chains";

const stableLaunchpadAbi = parseAbi([
  "function launchToken(string name, string symbol, string metadataURI, uint8 flavor, bytes32 salt, uint256 devBuyUsd, uint256 minDevBuyTokens) returns (address)",
  "function graduationStatus(address token) view returns (uint256 usdPrincipal, uint256 threshold, bool graduated)",
  "event TokenLaunched(address indexed token, address indexed creator, address pool, uint8 flavor, uint256 devBuyUsd, uint256 devBuyTokens)",
]);
const stableRouterAbi = parseAbi([
  "function buyExactUsd(address token, uint24 fee, uint256 usdIn, uint256 minTokensOut, address recipient) returns (uint256)",
  "function sellExactTokens(address token, uint24 fee, uint256 amountIn, uint256 minUsdOut, address recipient) returns (uint256)",
]);

const RPC = "http://127.0.0.1:8545";
const LAUNCHPAD = "0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0";
const ROUTER = "0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9";
const USDT0 = "0x5FbDB2315678afecb367f032d93F642f64180aa3";

const erc20 = parseAbi([
  "function approve(address, uint256) returns (bool)",
  "function balanceOf(address) view returns (uint256)",
  "function mint(address, uint256)",
]);

const KEYS = [
  "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80", // deployer/creator
  "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d", // trader A
  "0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a", // trader B
  "0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6", // whale
];

const pub = createPublicClient({ chain: foundry, transport: http(RPC) });
const wallets = KEYS.map((k) =>
  createWalletClient({ account: privateKeyToAccount(k), chain: foundry, transport: http(RPC) })
);

const usd = (n) => parseUnits(String(n), 6);

// Jump past the 120s anti-snipe window (2% max buy per wallet).
async function warp(seconds) {
  await pub.request({ method: "evm_increaseTime", params: [seconds] });
  await pub.request({ method: "evm_mine", params: [] });
}

async function send(wallet, req) {
  const hash = await wallet.writeContract(req);
  const receipt = await pub.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") throw new Error(`tx reverted: ${JSON.stringify(req.functionName)}`);
  return receipt;
}

async function launch(wallet, name, symbol, flavor = 0, devBuyUsd = 0n) {
  await send(wallet, {
    address: USDT0, abi: erc20, functionName: "approve", args: [LAUNCHPAD, devBuyUsd],
  });
  const salt = `0x${crypto.getRandomValues(new Uint8Array(32)).reduce((s, b) => s + b.toString(16).padStart(2, "0"), "")}`;
  const receipt = await send(wallet, {
    address: LAUNCHPAD,
    abi: stableLaunchpadAbi,
    functionName: "launchToken",
    args: [name, symbol, "", flavor, salt, devBuyUsd, 0n],
  });
  for (const log of receipt.logs) {
    try {
      const d = decodeEventLog({ abi: stableLaunchpadAbi, data: log.data, topics: log.topics });
      if (d.eventName === "TokenLaunched") {
        console.log(`launched ${symbol} -> token ${d.args.token} pool ${d.args.pool}`);
        return d.args.token;
      }
    } catch {}
  }
  throw new Error("TokenLaunched not found");
}

async function buy(wallet, token, dollars) {
  await send(wallet, { address: USDT0, abi: erc20, functionName: "approve", args: [ROUTER, usd(dollars)] });
  const r = await send(wallet, {
    address: ROUTER, abi: stableRouterAbi, functionName: "buyExactUsd",
    args: [token, 10000, usd(dollars), 0n, wallet.account.address],
  });
  console.log(`  buy $${dollars} by ${wallet.account.address.slice(0, 8)} ok (block ${r.blockNumber})`);
}

async function sell(wallet, token, tokens) {
  const amount = parseEther(String(tokens));
  await send(wallet, { address: token, abi: erc20, functionName: "approve", args: [ROUTER, amount] });
  const r = await send(wallet, {
    address: ROUTER, abi: stableRouterAbi, functionName: "sellExactTokens",
    args: [token, 10000, amount, 0n, wallet.account.address],
  });
  console.log(`  sell ${tokens} tokens by ${wallet.account.address.slice(0, 8)} ok (block ${r.blockNumber})`);
}

async function graduationStatus(token) {
  const [principal, threshold, graduated] = await pub.readContract({
    address: LAUNCHPAD, abi: stableLaunchpadAbi, functionName: "graduationStatus", args: [token],
  });
  console.log(`  graduation: $${formatUnits(principal, 6)} / $${formatUnits(threshold, 6)} graduated=${graduated}`);
  return graduated;
}

const [creator, alice, bob, whale] = wallets;

// Coin 1: dev buy + organic two-sided flow (stays on the curve).
const steed = await launch(creator, "Steed Coin", "STEED", 0, usd(250));
await warp(130);
await buy(alice, steed, 120);
await buy(bob, steed, 480);
const bobBal = await pub.readContract({ address: steed, abi: erc20, functionName: "balanceOf", args: [bob.account.address] });
await sell(bob, steed, Math.floor(Number(formatEther(bobBal)) / 3));
await buy(alice, steed, 60);
await graduationStatus(steed);

// Coin 2: pushed straight through the $12k milestone.
const barn = await launch(creator, "Barn Burner", "BARN", 0, 0n);
await warp(130);
await buy(whale, barn, 5000);
await buy(whale, barn, 5000);
await buy(whale, barn, 4000);
const graduated = await graduationStatus(barn);
if (!graduated) throw new Error("BARN should have graduated");

// Coin 3: a quiet fresh launch for the board.
await launch(alice, "Hay Day", "HAY", 0, usd(25));

console.log("e2e on-chain flow complete");
console.log(JSON.stringify({ steed, barn }));
