// Fires a few fresh router trades on the local stack so the 5-minute trending
// window has data. Run from stablepad/: node scripts/trade-once.mjs
import { createPublicClient, createWalletClient, http, parseAbi, parseUnits } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { foundry } from "viem/chains";

const RPC = "http://127.0.0.1:8545";
const ROUTER = "0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9";
const USDT0 = "0x5FbDB2315678afecb367f032d93F642f64180aa3";
const STEED = "0xBAfd372E2f7715330F74445B8284ef40b9233b9D";
const BARN = "0x7bA9Db182436E3Fd6249ADdBB77Ef35009C09d34";
const HAY = "0x783CA4C731F6677c017Fa53FF15F1959A3CC7539";

const erc20 = parseAbi(["function approve(address, uint256) returns (bool)"]);
const routerAbi = parseAbi([
  "function buyExactUsd(address token, uint24 fee, uint256 usdIn, uint256 minTokensOut, address recipient) returns (uint256)",
]);

const pub = createPublicClient({ chain: foundry, transport: http(RPC) });
const wallet = createWalletClient({
  account: privateKeyToAccount("0x47e179ec197488593b187f80a00eb0da91f1b9d0b13f8733639f19c30a34926a"),
  chain: foundry,
  transport: http(RPC),
});

async function buy(token, dollars) {
  let hash = await wallet.writeContract({
    address: USDT0, abi: erc20, functionName: "approve", args: [ROUTER, parseUnits(String(dollars), 6)],
  });
  await pub.waitForTransactionReceipt({ hash });
  hash = await wallet.writeContract({
    address: ROUTER, abi: routerAbi, functionName: "buyExactUsd",
    args: [token, 10000, parseUnits(String(dollars), 6), 0n, wallet.account.address],
  });
  await pub.waitForTransactionReceipt({ hash });
  console.log(`bought $${dollars} of ${token.slice(0, 8)}`);
}

await buy(STEED, 85);
await buy(BARN, 40);
await buy(HAY, 15);
console.log("done");
