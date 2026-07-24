"use client";

/**
 * DEXScreener's official embed for a coin's Uniswap v3 pool. Stable Chain is
 * indexed under chainId "stable", so every launch pool gets a pro chart for
 * free — trades panel and info column disabled to keep it chart-only.
 */
export function DexScreenerChart({ pool }: { pool: string }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-stbl-straw/40 bg-stbl-surface dark:border-stbl-700 dark:bg-stbl-900/60">
      <iframe
        title="dexscreener chart"
        src={`https://dexscreener.com/stable/${pool}?embed=1&theme=dark&trades=0&info=0&chartLeftToolbar=0&chartTheme=dark`}
        className="h-[500px] w-full border-0"
        allow="clipboard-write"
      />
    </div>
  );
}
