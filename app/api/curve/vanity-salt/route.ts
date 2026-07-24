import { NextResponse } from "next/server";
import { encodeAbiParameters, keccak256 } from "viem";

import { cleanEnv } from "@/lib/cleanEnv";

import { stableLaunchTokenBytecode } from "@/lib/evm/abi/stableLaunchTokenBytecode";
import { isEvmConfigured, launchpadAddress } from "@/lib/evm/chains";

export const runtime = "nodejs";

/** Every Stable token address ends in `5b1e` ("SBLE" — stable without the
 * vowels' luck; hex has no letters beyond f). This endpoint mines a CREATE2
 * salt for the exact launch parameters — the token constructor bakes in the
 * creator and flavor tax, so both must be final before mining. The launchpad
 * itself is the CREATE2 deployer; launchToken with the mined salt lands the
 * token on the predicted address. Falls back to a random salt (vanity: false)
 * if the budget runs out. Override the suffix with VANITY_SUFFIX (hex only). */

const SUFFIX = (cleanEnv(process.env.VANITY_SUFFIX) ?? "5b1e").toLowerCase();
const MAX_ITERATIONS = 400_000;
const TIME_BUDGET_MS = 9_000;

// Mirrors StableLaunchpad._flavorParams — Super LP bakes a 5% buy tax into
// the token constructor, the other flavors are tax-free.
const FLAVOR_TAX_BPS: Record<string, number> = {
  standard: 0,
  lpGrow: 0,
  superLp: 500,
};

function hexToBytes(hex: string): Uint8Array {
  const clean = hex.startsWith("0x") ? hex.slice(2) : hex;
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

function bytesToHex(bytes: Uint8Array): `0x${string}` {
  let s = "0x";
  for (const b of bytes) s += b.toString(16).padStart(2, "0");
  return s as `0x${string}`;
}

export async function POST(req: Request) {
  try {
    if (!isEvmConfigured()) {
      return NextResponse.json({ ok: false, error: "EVM not configured" }, { status: 500 });
    }
    const body = (await req.json()) as {
      name?: string;
      symbol?: string;
      metadataURI?: string;
      creator?: string;
      flavor?: string;
    };
    const name = String(body.name ?? "").slice(0, 64);
    const symbol = String(body.symbol ?? "").slice(0, 16);
    const metadataURI = String(body.metadataURI ?? "").slice(0, 300);
    const creator = String(body.creator ?? "").toLowerCase();
    if (!name || !symbol) {
      return NextResponse.json({ ok: false, error: "name and symbol required" }, { status: 400 });
    }
    if (!/^0x[0-9a-f]{40}$/.test(creator)) {
      return NextResponse.json({ ok: false, error: "creator wallet required" }, { status: 400 });
    }
    const taxBps = FLAVOR_TAX_BPS[String(body.flavor ?? "standard")];
    if (taxBps === undefined) {
      return NextResponse.json({ ok: false, error: "unknown flavor" }, { status: 400 });
    }

    const args = encodeAbiParameters(
      [
        { type: "string" },
        { type: "string" },
        { type: "string" },
        { type: "address" },
        { type: "uint16" },
      ],
      [name, symbol, metadataURI, creator as `0x${string}`, taxBps]
    );
    const initCodeHash = keccak256(
      (stableLaunchTokenBytecode + args.slice(2)) as `0x${string}`
    );

    // preimage = 0xff ++ launchpad(20) ++ salt(32) ++ initCodeHash(32)
    const preimage = new Uint8Array(85);
    preimage[0] = 0xff;
    preimage.set(hexToBytes(launchpadAddress()), 1);
    preimage.set(hexToBytes(initCodeHash), 53);

    // Random starting point so parallel launches don't collide on salts.
    const saltBytes = new Uint8Array(32);
    crypto.getRandomValues(saltBytes);

    const started = Date.now();
    for (let i = 0; i < MAX_ITERATIONS; i++) {
      // Increment the salt in place (roll over the last bytes).
      for (let b = 31; b >= 0; b--) {
        saltBytes[b] = (saltBytes[b] + 1) & 0xff;
        if (saltBytes[b] !== 0) break;
      }
      preimage.set(saltBytes, 21);
      const hash = keccak256(bytesToHex(preimage));
      if (hash.endsWith(SUFFIX)) {
        return NextResponse.json({
          ok: true,
          vanity: true,
          salt: bytesToHex(saltBytes),
          address: `0x${hash.slice(-40)}`,
          iterations: i + 1,
        });
      }
      if (i % 8_192 === 0 && Date.now() - started > TIME_BUDGET_MS) break;
    }

    // Budget exhausted — a random salt still works, just without the suffix.
    crypto.getRandomValues(saltBytes);
    return NextResponse.json({ ok: true, vanity: false, salt: bytesToHex(saltBytes) });
  } catch (err) {
    console.error("[api/curve/vanity-salt]", err);
    return NextResponse.json({ ok: false, error: "mining failed" }, { status: 500 });
  }
}
