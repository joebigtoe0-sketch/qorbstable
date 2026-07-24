"use client";

import Link from "next/link";

import { useCurrency } from "@/components/curve/CurrencyProvider";
import { ipfsToHttp } from "@/lib/evm/ipfs";
import type { CurveTokenJson } from "@/types/curve";

function timeAgo(iso: string): string {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return `${Math.floor(s)}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export function CurveTokenCard({ token }: { token: CurveTokenJson }) {
  const { fmt } = useCurrency();
  const offCurve = token.phase !== "trading";
  const pct = Math.round(token.progress * 100);

  return (
    <Link
      href={`/coin/${token.address}`}
      className="group flex flex-col rounded-2xl border border-stbl-straw/40 bg-stbl-surface p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-stbl-yolk/70 hover:shadow-md dark:border-stbl-700 dark:bg-stbl-900/60"
    >
      <div className="flex items-start gap-3">
        {token.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={ipfsToHttp(token.imageUrl)}
            alt=""
            className="h-14 w-14 shrink-0 rounded-xl object-cover"
          />
        ) : (
          <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-stbl-yolk/20 font-display text-lg font-extrabold text-stbl-wood dark:text-stbl-yolk">
            {token.symbol.slice(0, 3) || "?"}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate font-display text-sm font-extrabold text-stbl-ink dark:text-stbl-shell">
              {token.name || "Unnamed token"}
            </p>
            <span className="shrink-0 rounded bg-stbl-surface-warm px-1.5 py-0.5 font-mono text-[10px] font-bold text-stbl-wood dark:bg-stbl-800 dark:text-stbl-shell/80">
              {token.symbol}
            </span>
          </div>
          <p className="mt-0.5 line-clamp-2 text-xs leading-snug text-stbl-wood/70 dark:text-stbl-shell/55">
            {token.description || "No description yet."}
          </p>
        </div>
      </div>

      <div className="mt-3 flex items-center gap-2 text-[11px] lowercase text-stbl-wood/70 dark:text-stbl-shell/55">
        <span className="font-mono font-semibold text-stbl-ink dark:text-stbl-shell">
          {fmt(token.marketCapUsd)} mcap
        </span>
        {token.tradeCount > 0 ? (
          <span
            className={`rounded-full px-1.5 py-0.5 font-mono text-[10px] font-bold ${
              token.change24h >= 0
                ? "bg-emerald-400/10 text-emerald-400"
                : "bg-red-400/10 text-red-400"
            }`}
          >
            {token.change24h >= 0 ? "+" : ""}
            {(token.change24h * 100).toFixed(1)}%
          </span>
        ) : null}
        <span>·</span>
        <span className="font-mono">{fmt(token.volumeUsd)} vol</span>
        <span className="ml-auto">{timeAgo(token.createdAt)}</span>
      </div>

      <div className="mt-2">
        {offCurve ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-400/10 px-2 py-0.5 font-mono text-[10px] font-bold lowercase text-emerald-400">
            graduated — lp locked forever
          </span>
        ) : (
          <>
            <div className="h-2 overflow-hidden rounded-full bg-stbl-surface-warm dark:bg-stbl-800">
              <div
                className="h-full rounded-full bg-gradient-to-r from-stbl-yolk to-stbl-orange transition-all"
                style={{ width: `${Math.max(2, pct)}%` }}
              />
            </div>
            <div className="mt-1 flex justify-between font-mono text-[10px] lowercase text-stbl-wood/60 dark:text-stbl-shell/45">
              <span className="rounded-full bg-stbl-orange/10 px-1.5 text-stbl-orange">
                bonding {pct}%
              </span>
              <span>
                ${token.raisedUsd.toLocaleString("en-US", { maximumFractionDigits: 0 })} / $12,000
              </span>
            </div>
          </>
        )}
      </div>
    </Link>
  );
}
