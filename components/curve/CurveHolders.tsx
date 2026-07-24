"use client";

import { activeChain } from "@/lib/evm/chains";
import type { CurveHolderJson } from "@/types/curve";

const TAG_LABELS: Record<string, string> = {
  creator: "creator",
  pair: "locked AMM pool",
  burn: "burned",
  curve: "bonding curve",
};

function short(addr: string): string {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

export function CurveHolders({
  holders,
  holderCount,
}: {
  holders: CurveHolderJson[];
  holderCount: number;
}) {
  const explorer = activeChain().blockExplorers?.default.url ?? "";

  return (
    <div className="rounded-2xl border border-stbl-straw/40 bg-stbl-surface p-4 dark:border-stbl-700 dark:bg-stbl-900/60">
      <div className="flex items-baseline justify-between">
        <h3 className="text-xs font-bold lowercase tracking-wider text-stbl-wood/70 dark:text-stbl-shell/60">
          Holders
        </h3>
        <span className="text-[11px] text-stbl-wood/60 dark:text-stbl-shell/50">
          {holderCount} holders
        </span>
      </div>
      {holders.length === 0 ? (
        <p className="py-4 text-center text-sm text-stbl-wood/60 dark:text-stbl-shell/50">
          No holders yet.
        </p>
      ) : (
        <ul className="mt-2 space-y-1 text-xs">
          {holders.map((h) => (
            <li key={h.holder} className="flex items-center gap-2 py-0.5">
              <a
                href={explorer ? `${explorer}/address/${h.holder}` : "#"}
                target="_blank"
                rel="noreferrer"
                className="font-mono hover:text-stbl-orange hover:underline"
              >
                {short(h.holder)}
              </a>
              {h.tag ? (
                <span className="rounded bg-stbl-surface-warm px-1.5 py-0.5 text-[10px] font-semibold text-stbl-wood/80 dark:bg-stbl-800 dark:text-stbl-shell/60">
                  {TAG_LABELS[h.tag] ?? h.tag}
                </span>
              ) : null}
              <span className="ml-auto font-mono font-semibold text-stbl-ink dark:text-stbl-shell">
                {h.pct.toFixed(2)}%
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
