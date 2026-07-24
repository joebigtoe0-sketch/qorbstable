import { defineChain, type Chain } from "viem";

import { cleanEnv } from "@/lib/cleanEnv";

/**
 * Stable Chain mainnet (chain 988). Native gas is USDT0; the canonical ERC20
 * interface to it (6 decimals) is what every pool pairs against.
 * Canonical explorer: stablescan.xyz.
 */
export const stableChain = defineChain({
  id: 988,
  name: "Stable",
  nativeCurrency: { name: "USDT0", symbol: "USDT0", decimals: 18 },
  rpcUrls: {
    default: {
      http: [
        cleanEnv(process.env.NEXT_PUBLIC_STABLE_RPC_URL) ?? "https://rpc.stable.xyz",
      ],
    },
  },
  blockExplorers: {
    default: {
      name: "Stablescan",
      url: "https://stablescan.xyz",
    },
  },
});

/** Local anvil stack (deploy with `npm run evm:local`). */
export const localAnvil = defineChain({
  id: 31337,
  name: "Anvil (local)",
  nativeCurrency: { name: "USDT0", symbol: "USDT0", decimals: 18 },
  rpcUrls: {
    default: {
      http: [cleanEnv(process.env.NEXT_PUBLIC_LOCAL_RPC_URL) ?? "http://127.0.0.1:8545"],
    },
  },
  testnet: true,
});

const chainsByKey: Record<string, Chain> = {
  stable: stableChain,
  local: localAnvil,
};

/** Canonical protocol addresses on Stable mainnet. */
export const STABLE_MAINNET = {
  uniswapV3Factory: "0x88F0a512eF09175D456bc9547f914f48C013E4aA",
  usdt0: "0x779ded0c9e1022225f8e0630b35a9b54be713736",
} as const;

/**
 * Canonical deployments per chain. Selecting the chain via
 * NEXT_PUBLIC_EVM_CHAIN is the ONLY switch needed — addresses and the indexer
 * start block follow automatically. Env vars (NEXT_PUBLIC_LAUNCHPAD_ADDRESS /
 * NEXT_PUBLIC_ROUTER_ADDRESS / NEXT_PUBLIC_USDT0_ADDRESS /
 * EVM_INDEXER_START_BLOCK) still override for local anvil runs. Fill in
 * `stable` after the mainnet deploy.
 */
const DEPLOYMENTS: Record<
  string,
  | {
      launchpad: `0x${string}`;
      router: `0x${string}`;
      usdt0: `0x${string}`;
      startBlock: string;
      /** Retired launchpads whose tokens stay indexed/visible. startBlock
       * must cover the OLDEST of these; adding one later needs a DB re-index
       * (the indexer resets automatically when the primary changes). */
      legacyLaunchpads?: `0x${string}`[];
    }
  | undefined
> = {
  // v2 launchpad (Standard-only, contract-enforced) deployed 2026-07-25 at
  // block 32984191; locker 0x0eDb3514…5dF87D. v1 launchpad kept as legacy so
  // its tokens stay indexed. Router is launchpad-independent and unchanged.
  stable: {
    launchpad: "0xb44a8a84257a56398465D717ca55859Ac742498a",
    router: "0x1CcB2F4c6dA5EB448c2ef84EF235919f7270C646",
    usdt0: "0x779Ded0c9e1022225f8E0630b35a9b54bE713736",
    startBlock: "32955608",
    legacyLaunchpads: ["0xB63a05e220E6a6D4BE8bE23b84E2a506537B8633"],
  },
};

function chainKey(): string {
  return cleanEnv(process.env.NEXT_PUBLIC_EVM_CHAIN) || "local";
}

/** Active chain, selected with NEXT_PUBLIC_EVM_CHAIN=stable|local. */
export function activeChain(): Chain {
  const chain = chainsByKey[chainKey()];
  if (!chain) {
    throw new Error(
      `Unknown NEXT_PUBLIC_EVM_CHAIN "${chainKey()}" (expected stable | local)`
    );
  }
  return chain;
}

export function launchpadAddress(): `0x${string}` {
  const env = cleanEnv(process.env.NEXT_PUBLIC_LAUNCHPAD_ADDRESS);
  if (env && env.startsWith("0x")) return env as `0x${string}`;
  const deployment = DEPLOYMENTS[chainKey()];
  if (deployment) return deployment.launchpad;
  throw new Error(
    "No launchpad for this chain — set NEXT_PUBLIC_LAUNCHPAD_ADDRESS (local/anvil runs need it)"
  );
}

/** StableRouter — the USDT0<->token swap helper the trade widgets use. */
export function routerAddress(): `0x${string}` {
  const env = cleanEnv(process.env.NEXT_PUBLIC_ROUTER_ADDRESS);
  if (env && env.startsWith("0x")) return env as `0x${string}`;
  const deployment = DEPLOYMENTS[chainKey()];
  if (deployment) return deployment.router;
  throw new Error(
    "No router for this chain — set NEXT_PUBLIC_ROUTER_ADDRESS (local/anvil runs need it)"
  );
}

/** Canonical ERC20 USDT0 (6 decimals) — the quote side of every pool. */
export function usdt0Address(): `0x${string}` {
  const env = cleanEnv(process.env.NEXT_PUBLIC_USDT0_ADDRESS);
  if (env && env.startsWith("0x")) return env as `0x${string}`;
  const deployment = DEPLOYMENTS[chainKey()];
  if (deployment) return deployment.usdt0;
  if (chainKey() === "stable") return STABLE_MAINNET.usdt0;
  throw new Error(
    "No USDT0 for this chain — set NEXT_PUBLIC_USDT0_ADDRESS (local/anvil runs need it)"
  );
}

/** Retired launchpads whose tokens the indexer keeps watching. */
export function legacyLaunchpadAddresses(): `0x${string}`[] {
  return DEPLOYMENTS[chainKey()]?.legacyLaunchpads ?? [];
}

/** First block the indexer scans on a fresh database. */
export function indexerStartBlock(): string | undefined {
  const env = cleanEnv(process.env.EVM_INDEXER_START_BLOCK);
  if (env) return env;
  return DEPLOYMENTS[chainKey()]?.startBlock;
}

export function isEvmConfigured(): boolean {
  try {
    return launchpadAddress().length === 42;
  } catch {
    return false;
  }
}

export function explorerUrl(kind: "tx" | "address" | "token", value: string): string {
  const base = activeChain().blockExplorers?.default.url;
  if (!base) return "";
  return `${base}/${kind === "tx" ? "tx" : kind === "token" ? "token" : "address"}/${value}`;
}
