/**
 * Display math for the v3-direct launchpad (mirrors evm/src/StableLaunchpad.sol).
 *
 * Units: the launch token has 18 decimals; USDT0 has 6. The pool's raw price
 * (token1 per token0) therefore differs from the human USD-per-token price by
 * 1e12 when the token is token0 (and its inverse otherwise) — the indexer
 * stores prices already normalized to USD per whole token.
 */
export const TOTAL_SUPPLY_TOKENS = 1e9; // 1B whole tokens
export const GRADUATION_USD = 12_000; // graduation threshold, in dollars
export const POOL_FEE = 0.01; // Uniswap v3 1% tier
export const POOL_FEE_TIER = 10_000; // same, in Uniswap units

const INITIAL_TICK = -400_600;
const MAX_TICK = 887_200;

function sqrtRatioAtTick(tick: number): number {
  return Math.pow(1.0001, tick / 2);
}

export function formatUsd(v: number, digits = 2): string {
  return v.toLocaleString("en-US", { maximumFractionDigits: digits });
}

export function formatTokenAmount(raw: bigint | string): string {
  const v = typeof raw === "string" ? BigInt(raw) : raw;
  const n = Number(v) / 1e18;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(2)}k`;
  return n.toFixed(2);
}

/**
 * Estimate how many tokens a dev buy of `usdIn` dollars receives at launch.
 * The launch mints the entire supply single-sided into a v3 range, so the dev
 * buy is a swap that walks price up that range from the very bottom. Display
 * only — the actual output is whatever the swap returns on-chain.
 *
 * Units trick: work in "raw" space where token amounts are whole tokens and
 * usd amounts are (dollars × 1e-12) so the raw v3 price (6-dec per 18-dec)
 * stays consistent; the 1e-12 cancels out in the output.
 */
export function quoteDevBuyTokens(usdIn: number): number {
  if (!(usdIn > 0)) return 0;
  const sqrtLower = sqrtRatioAtTick(INITIAL_TICK);
  const sqrtUpper = sqrtRatioAtTick(MAX_TICK);
  // Position is all token at the bottom of the range.
  const L = (TOTAL_SUPPLY_TOKENS * (sqrtLower * sqrtUpper)) / (sqrtUpper - sqrtLower);
  const dy = usdIn * 1e-12 * (1 - POOL_FEE); // USD leg in raw units, after pool fee
  const sqrtNew = sqrtLower + dy / L;
  const tokensOut = L * (1 / sqrtLower - 1 / sqrtNew);
  return Math.max(0, Math.min(tokensOut, TOTAL_SUPPLY_TOKENS));
}

/** Dev-buy tokens as a percentage of total supply (for a “X% of supply” hint). */
export function devBuySupplyPct(usdIn: number): number {
  return (quoteDevBuyTokens(usdIn) / TOTAL_SUPPLY_TOKENS) * 100;
}

/**
 * Client-side swap estimate against the live pool (single locked position, so
 * closed-form within the range). `sqrtPriceX96` and `liquidity` come straight
 * from the pool; `tokenIs0` from the launch record.
 *
 * Returns whole-token / dollar amounts. Estimates only — the router enforces
 * minOut on-chain.
 */
export function quotePoolSwap(params: {
  sqrtPriceX96: bigint;
  liquidity: bigint;
  tokenIs0: boolean;
  direction: "buy" | "sell";
  amountIn: number; // dollars for buys, whole tokens for sells
}): number {
  const { sqrtPriceX96, liquidity, tokenIs0, direction, amountIn } = params;
  if (!(amountIn > 0) || liquidity === 0n) return 0;
  const sqrtP = Number(sqrtPriceX96) / 2 ** 96;
  const L = Number(liquidity);
  const feeMult = 1 - POOL_FEE;

  // Raw-unit conversions: token amounts ×1e18, usd amounts ×1e6.
  if (direction === "buy") {
    const dIn = amountIn * 1e6 * feeMult; // USD side in, raw
    if (tokenIs0) {
      // USD is token1: price moves up; tokens out from token0 side.
      const sqrtNew = sqrtP + dIn / L;
      const out = L * (1 / sqrtP - 1 / sqrtNew);
      return Math.max(0, out / 1e18);
    }
    // USD is token0: price moves down; tokens out from token1 side.
    const sqrtNew = (L * sqrtP) / (L + dIn * sqrtP);
    const out = L * (sqrtP - sqrtNew);
    return Math.max(0, out / 1e18);
  }
  // sell: token side in, USD out
  const dIn = amountIn * 1e18 * feeMult;
  if (tokenIs0) {
    const sqrtNew = (L * sqrtP) / (L + dIn * sqrtP);
    const out = L * (sqrtP - sqrtNew);
    return Math.max(0, out / 1e6);
  }
  const sqrtNew = sqrtP + dIn / L;
  const out = L * (1 / sqrtP - 1 / sqrtNew);
  return Math.max(0, out / 1e6);
}
