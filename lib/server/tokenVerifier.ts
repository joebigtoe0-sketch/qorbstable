import { encodeAbiParameters } from "viem";

import { cleanEnv } from "@/lib/cleanEnv";
import { activeChain } from "@/lib/evm/chains";

import stdJson from "./stableLaunchToken.stdjson.json";

/**
 * Auto-verifies a freshly launched StableLaunchToken's source on stablescan.
 *
 * Terminals (GMGN/GoPlus etc.) decompile UNVERIFIED bytecode and misread the
 * anti-snipe/dev-buy mechanics as honeypot/backdoor flags; with verified
 * source they read the real code and the flags disappear. Every launch gets
 * verified automatically.
 *
 * stablescan is part of the Etherscan EAAS network, so verification goes
 * through the unified Etherscan V2 API (chainid=988) with a regular Etherscan
 * API key — set ETHERSCAN_API_KEY. The committed standard-JSON input comes
 * from `forge verify-contract --show-standard-json-input` on the same build
 * that deploys; keep COMPILER_VERSION in sync with `evm/out`'s metadata.
 */
const COMPILER_VERSION = "v0.8.35+commit.47b9dedd";
const CONTRACT_NAME = "src/tokens/StableLaunchToken.sol:StableLaunchToken";
const API_URL = "https://api.etherscan.io/v2/api?chainid=988";
// First attempt waits for the explorer to index the new contract; later
// attempts retry through indexing lag and API hiccups.
const ATTEMPT_DELAYS_MS = [45_000, 180_000, 600_000];

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function apiKey(): string | null {
  return cleanEnv(process.env.ETHERSCAN_API_KEY) ?? null;
}

async function isVerified(key: string, token: string): Promise<boolean> {
  const res = await fetch(
    `${API_URL}&module=contract&action=getabi&address=${token}&apikey=${key}`,
    { signal: AbortSignal.timeout(20_000) }
  );
  const j = (await res.json().catch(() => null)) as { status?: string } | null;
  return j?.status === "1";
}

export interface TokenVerifyFields {
  name: string;
  symbol: string;
  metadataUri: string;
  creator: `0x${string}`;
  taxBps: number;
}

/** Fire-and-forget: submit source verification with retries. Never throws. */
export function verifyTokenSource(token: string, fields: TokenVerifyFields): void {
  const key = apiKey();
  // Only meaningful on mainnet with a key — local anvil has no explorer.
  if (!key || activeChain().id !== 988) return;

  void (async () => {
    for (const delay of ATTEMPT_DELAYS_MS) {
      await sleep(delay);
      try {
        if (await isVerified(key, token)) {
          console.log(`[token-verifier] ${token} verified ✓`);
          return;
        }

        const ctorArgs = encodeAbiParameters(
          [
            { type: "string" },
            { type: "string" },
            { type: "string" },
            { type: "address" },
            { type: "uint16" },
          ],
          [fields.name, fields.symbol, fields.metadataUri, fields.creator, fields.taxBps]
        );

        const form = new FormData();
        form.set("module", "contract");
        form.set("action", "verifysourcecode");
        form.set("apikey", key);
        form.set("codeformat", "solidity-standard-json-input");
        form.set("sourceCode", JSON.stringify(stdJson));
        form.set("contractaddress", token);
        form.set("contractname", CONTRACT_NAME);
        form.set("compilerversion", COMPILER_VERSION);
        // Etherscan's historical field name really is misspelled like this.
        form.set("constructorArguements", ctorArgs.slice(2));

        const res = await fetch(API_URL, {
          method: "POST",
          body: form,
          signal: AbortSignal.timeout(60_000),
        });
        const j = (await res.json().catch(() => null)) as {
          status?: string;
          result?: string;
        } | null;
        console.log(
          `[token-verifier] ${token} submitted (status ${j?.status ?? res.status}: ${j?.result ?? ""})`
        );
      } catch (err) {
        console.warn(
          `[token-verifier] ${token} attempt failed:`,
          err instanceof Error ? err.message : err
        );
      }
    }
    // Final status for the logs — verification lands async on their side.
    try {
      const ok = await isVerified(key, token);
      console.log(`[token-verifier] ${token} final status: ${ok ? "verified ✓" : "unverified"}`);
    } catch {
      /* logging only */
    }
  })();
}
