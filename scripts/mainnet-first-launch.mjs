// One-time mainnet smoke test: mine a …5b1e salt and launch the first coin
// through the freshly deployed launchpad. Run from stablepad/:
//   node scripts/mainnet-first-launch.mjs
import {
  createPublicClient,
  createWalletClient,
  decodeEventLog,
  defineChain,
  encodeAbiParameters,
  http,
  keccak256,
  parseAbi,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { readFileSync } from "fs";

const LAUNCHPAD = "0xB63a05e220E6a6D4BE8bE23b84E2a506537B8633";
const DEPLOYER_KEY = "0x861c39cee47697d38c3bfb37f21385b21a42610bdf089cf542f6b75d343a13a8";
const NAME = "First Light";
const SYMBOL = "FIRST";

const stable = defineChain({
  id: 988,
  name: "Stable",
  nativeCurrency: { name: "USDT0", symbol: "USDT0", decimals: 18 },
  rpcUrls: { default: { http: ["https://rpc.stable.xyz"] } },
});

const account = privateKeyToAccount(DEPLOYER_KEY);
const pub = createPublicClient({ chain: stable, transport: http() });
const wallet = createWalletClient({ account, chain: stable, transport: http() });

const abi = parseAbi([
  "function launchToken(string, string, string, uint8, bytes32, uint256, uint256) returns (address)",
  "event TokenLaunched(address indexed token, address indexed creator, address pool, uint8 flavor, uint256 devBuyUsd, uint256 devBuyTokens)",
]);

// Mine the …5b1e CREATE2 salt (deployer = launchpad, creator baked into args).
const artifact = JSON.parse(
  readFileSync("evm/out/StableLaunchToken.sol/StableLaunchToken.json", "utf8")
);
const args = encodeAbiParameters(
  [{ type: "string" }, { type: "string" }, { type: "string" }, { type: "address" }, { type: "uint16" }],
  [NAME, SYMBOL, "", account.address, 0]
);
const initCodeHash = keccak256((artifact.bytecode.object + args.slice(2)));

const hexToBytes = (h) => Uint8Array.from(Buffer.from(h.replace(/^0x/, ""), "hex"));
const bytesToHex = (b) => "0x" + Buffer.from(b).toString("hex");
const preimage = new Uint8Array(85);
preimage[0] = 0xff;
preimage.set(hexToBytes(LAUNCHPAD), 1);
preimage.set(hexToBytes(initCodeHash), 53);
const salt = new Uint8Array(32);
crypto.getRandomValues(salt);
let predicted = "";
const started = Date.now();
for (let i = 0; ; i++) {
  for (let b = 31; b >= 0; b--) { salt[b] = (salt[b] + 1) & 0xff; if (salt[b] !== 0) break; }
  preimage.set(salt, 21);
  const h = keccak256(bytesToHex(preimage));
  if (h.endsWith("5b1e")) { predicted = `0x${h.slice(-40)}`; console.log(`mined in ${i + 1} tries (${Date.now() - started}ms): ${predicted}`); break; }
}

const hash = await wallet.writeContract({
  address: LAUNCHPAD, abi, functionName: "launchToken",
  args: [NAME, SYMBOL, "", 0, bytesToHex(salt), 0n, 0n],
});
console.log("tx:", hash);
const receipt = await pub.waitForTransactionReceipt({ hash });
console.log("status:", receipt.status, "block:", receipt.blockNumber, "gas:", receipt.gasUsed);
for (const log of receipt.logs) {
  try {
    const d = decodeEventLog({ abi, data: log.data, topics: log.topics });
    if (d.eventName === "TokenLaunched") {
      console.log("token:", d.args.token);
      console.log("pool:", d.args.pool);
      console.log("vanity match:", d.args.token.toLowerCase() === predicted.toLowerCase());
    }
  } catch {}
}
