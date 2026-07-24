"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { CreatorRewards } from "@/components/curve/CreatorRewards";
import { CurveChart } from "@/components/curve/CurveChart";
import { DexScreenerChart } from "@/components/curve/DexScreenerChart";
import { CurveHolders } from "@/components/curve/CurveHolders";
import { CurveTradesFeed } from "@/components/curve/CurveTradesFeed";
import { CurveTradeWidget } from "@/components/curve/CurveTradeWidget";
import { useCurrency } from "@/components/curve/CurrencyProvider";
import { MagnetIcon, XIcon } from "@/components/icons";
import { activeChain } from "@/lib/evm/chains";
import { ipfsToHttp } from "@/lib/evm/ipfs";
import type { CurveHolderJson, CurveTokenJson } from "@/types/curve";

function short(addr: string): string {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

/** Contract address that copies itself to the clipboard on click. */
function CopyAddress({ address }: { address: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      title="Copy contract address"
      onClick={() => {
        void navigator.clipboard.writeText(address).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        });
      }}
      className="inline-flex items-center gap-1 font-mono transition hover:text-stbl-orange"
    >
      {short(address)}
      {copied ? (
        <span className="font-sans text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
          copied!
        </span>
      ) : (
        <svg
          className="h-3 w-3 opacity-60"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          aria-hidden
        >
          <rect x="5.5" y="5.5" width="8" height="8" rx="1.5" />
          <path d="M10.5 5.5V4a1.5 1.5 0 0 0-1.5-1.5H4A1.5 1.5 0 0 0 2.5 4v5A1.5 1.5 0 0 0 4 10.5h1.5" />
        </svg>
      )}
    </button>
  );
}

export function CoinPageClient({ address }: { address: string }) {
  const [token, setToken] = useState<CurveTokenJson | null>(null);
  const [holders, setHolders] = useState<CurveHolderJson[]>([]);
  const [feedTab, setFeedTab] = useState<"trades" | "holders">("trades");
  // DEXScreener indexes Stable mainnet pools (chainId "stable") — offer their
  // chart there, fall back to ours on local dev where they can't see the pool.
  const [chartSrc, setChartSrc] = useState<"dexscreener" | "qorb">("dexscreener");
  const [notFound, setNotFound] = useState(false);
  // Fresh launches take a few seconds to hit the indexer — show a hatching
  // screen instead of "not found" while within the grace window.
  const [graceOver, setGraceOver] = useState(false);
  const { fmt } = useCurrency();
  const explorer = activeChain().blockExplorers?.default.url ?? "";

  useEffect(() => {
    const id = setTimeout(() => setGraceOver(true), 60_000);
    return () => clearTimeout(id);
  }, []);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/curve/tokens/${address}`, { cache: "no-store" });
      if (res.status === 404) {
        setNotFound(true);
        return;
      }
      const data = (await res.json()) as {
        token?: CurveTokenJson | null;
        holders?: CurveHolderJson[];
      };
      if (data.token) {
        setToken(data.token);
        setHolders(data.holders ?? []);
        setNotFound(false);
      }
    } catch {
      /* transient */
    }
  }, [address]);

  useEffect(() => {
    void load();
    const id = setInterval(() => void load(), 6_000);
    return () => clearInterval(id);
  }, [load]);

  if (notFound && !graceOver) {
    return (
      <div className="rounded-2xl border border-dashed border-stbl-straw/50 bg-stbl-surface-warm/30 px-6 py-16 text-center dark:border-stbl-700 dark:bg-stbl-800/30">
        <MagnetIcon className="mx-auto h-10 w-10 animate-bounce text-stbl-yolk/60" />
        <p className="mt-3 font-display text-lg font-extrabold lowercase text-stbl-ink dark:text-stbl-shell">
          settling in…
        </p>
        <p className="mt-1 text-sm lowercase text-stbl-wood/70 dark:text-stbl-shell/60">
          the coin is on-chain — the indexer is catching up. this page loads
          itself in a few seconds.
        </p>
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="rounded-2xl border border-dashed border-stbl-straw/50 bg-stbl-surface-warm/30 px-6 py-16 text-center dark:border-stbl-700 dark:bg-stbl-800/30">
        <MagnetIcon className="mx-auto h-10 w-10 text-stbl-shell/30" />
        <p className="mt-3 font-display text-lg font-extrabold lowercase text-stbl-ink dark:text-stbl-shell">
          coin not found
        </p>
        <p className="mt-1 text-sm lowercase text-stbl-wood/70 dark:text-stbl-shell/60">
          this coin doesn&apos;t exist, or the indexer hasn&apos;t seen it yet.
        </p>
        <Link
          href="/"
          className="mt-5 inline-block rounded-xl bg-stbl-yolk px-5 py-2.5 text-sm font-bold text-stbl-950 transition hover:brightness-110"
        >
          back to qorb
        </Link>
      </div>
    );
  }

  if (!token) {
    return (
      <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
        <div className="h-[420px] animate-pulse rounded-2xl bg-stbl-surface-warm/40 dark:bg-stbl-800/40" />
        <div className="h-[420px] animate-pulse rounded-2xl bg-stbl-surface-warm/40 dark:bg-stbl-800/40" />
      </div>
    );
  }

  const pct = Math.round(token.progress * 100);
  const dexScreenerAvailable = activeChain().id === 988 && Boolean(token.pair);

  return (
    <div className="space-y-4 pb-8">
      {/* header */}
      <div className="flex flex-wrap items-center gap-4 rounded-2xl border border-stbl-straw/40 bg-stbl-surface p-4 dark:border-stbl-700 dark:bg-stbl-900/60">
        {token.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={ipfsToHttp(token.imageUrl)}
            alt=""
            className="h-16 w-16 rounded-2xl object-cover"
          />
        ) : (
          <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-stbl-yolk/20 font-display text-xl font-extrabold text-stbl-wood dark:text-stbl-yolk">
            {token.symbol.slice(0, 3) || "?"}
          </span>
        )}
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-display text-xl font-extrabold text-stbl-ink dark:text-stbl-shell">
              {token.name}
            </h1>
            <span className="rounded bg-stbl-surface-warm px-2 py-0.5 font-mono text-xs font-bold text-stbl-wood dark:bg-stbl-800 dark:text-stbl-shell/80">
              {token.symbol}
            </span>
          </div>
          <p className="mt-1 text-xs text-stbl-wood/70 dark:text-stbl-shell/55">
            created by{" "}
            <a
              href={explorer ? `${explorer}/address/${token.creator}` : "#"}
              target="_blank"
              rel="noreferrer"
              className="font-mono hover:text-stbl-orange hover:underline"
            >
              {short(token.creator)}
            </a>{" "}
            · <span className="lowercase">ca:</span>{" "}
            <CopyAddress address={token.address} />
            {explorer ? (
              <>
                {" "}
                <a
                  href={`${explorer}/token/${token.address}`}
                  target="_blank"
                  rel="noreferrer"
                  aria-label="View contract on explorer"
                  title="View on explorer"
                  className="inline-block align-middle hover:text-stbl-orange"
                >
                  <svg
                    className="h-3 w-3 opacity-60"
                    viewBox="0 0 16 16"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    aria-hidden
                  >
                    <path d="M6.5 3.5H3.5A1.5 1.5 0 0 0 2 5v7.5A1.5 1.5 0 0 0 3.5 14H11a1.5 1.5 0 0 0 1.5-1.5V9.5M9.5 2H14v4.5M14 2 7.5 8.5" />
                  </svg>
                </a>
              </>
            ) : null}
          </p>
          {token.description ? (
            <p className="mt-1 max-w-xl text-xs leading-snug text-stbl-wood/75 dark:text-stbl-shell/60">
              {token.description}
            </p>
          ) : null}
          <div className="mt-1 flex gap-3 text-xs">
            {token.website ? (
              <a href={token.website} target="_blank" rel="noreferrer" className="text-stbl-sky hover:underline">
                website
              </a>
            ) : null}
            {token.twitter ? (
              <a
                href={token.twitter}
                target="_blank"
                rel="noreferrer"
                aria-label="X / Twitter"
                className="inline-flex items-center text-stbl-sky hover:underline"
              >
                <XIcon className="h-3 w-3" />
              </a>
            ) : null}
            {token.telegram ? (
              <a href={token.telegram} target="_blank" rel="noreferrer" className="text-stbl-sky hover:underline">
                telegram
              </a>
            ) : null}
          </div>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-x-8 gap-y-2">
          {[
            { label: "market cap", value: fmt(token.marketCapUsd) },
            { label: "volume", value: fmt(token.volumeUsd) },
            { label: "trades", value: String(token.tradeCount) },
            { label: "holders", value: String(token.holderCount ?? "—") },
          ].map((s) => (
            <div key={s.label} className="text-right">
              <p className="text-[10px] lowercase tracking-wider text-stbl-wood/55 dark:text-stbl-shell/45">
                {s.label}
              </p>
              <p className="font-mono text-sm font-bold text-stbl-ink dark:text-stbl-shell">
                {s.value}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* curve progress */}
      {token.phase === "trading" ? (
        <div className="rounded-2xl border border-stbl-straw/40 bg-stbl-surface p-4 dark:border-stbl-700 dark:bg-stbl-900/60">
          <div className="flex items-baseline justify-between text-xs">
            <span className="font-bold lowercase tracking-wider text-stbl-wood/70 dark:text-stbl-shell/60">
              Bonding curve {pct}%
            </span>
            <span className="font-mono text-stbl-wood/70 dark:text-stbl-shell/55">
              ${token.raisedUsd.toLocaleString("en-US", { maximumFractionDigits: 0 })} / $12,000
              in the bonding curve — graduates at 100%
            </span>
          </div>
          <div className="mt-2 h-3 overflow-hidden rounded-full bg-stbl-surface-warm dark:bg-stbl-800">
            <div
              className="h-full rounded-full bg-gradient-to-r from-stbl-yolk to-stbl-orange transition-all"
              style={{ width: `${Math.max(2, pct)}%` }}
            />
          </div>
        </div>
      ) : null}

      <div className="grid items-start gap-4 lg:grid-cols-[1fr_340px]">
        <div className="min-w-0 space-y-4">
          {dexScreenerAvailable ? (
            <div className="space-y-3">
              <div className="flex w-fit rounded-xl border border-stbl-700 bg-stbl-900/60 p-1">
                {(["dexscreener", "qorb"] as const).map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setChartSrc(s)}
                    className={`rounded-lg px-4 py-1.5 text-xs font-bold lowercase transition ${
                      chartSrc === s
                        ? "bg-stbl-yolk/25 text-stbl-shell"
                        : "text-stbl-shell/55 hover:text-stbl-shell"
                    }`}
                  >
                    {s === "dexscreener" ? "dexscreener" : "qorb chart"}
                  </button>
                ))}
              </div>
              {chartSrc === "dexscreener" ? (
                <DexScreenerChart pool={token.pair} />
              ) : (
                <CurveChart address={token.address} />
              )}
            </div>
          ) : (
            <CurveChart address={token.address} />
          )}
        </div>
        <div className="space-y-4">
          <CurveTradeWidget token={token} onTraded={() => void load()} />
          <CreatorRewards token={token} />
        </div>
      </div>

      {/* trades / holders — full width, tabbed */}
      <div>
        <div className="mb-3 flex w-fit rounded-xl border border-stbl-700 bg-stbl-900/60 p-1">
          {(["trades", "holders"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setFeedTab(t)}
              className={`rounded-lg px-4 py-1.5 text-xs font-bold lowercase transition ${
                feedTab === t
                  ? "bg-stbl-yolk/25 text-stbl-shell"
                  : "text-stbl-shell/55 hover:text-stbl-shell"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
        {feedTab === "trades" ? (
          <CurveTradesFeed address={token.address} symbol={token.symbol} />
        ) : (
          <CurveHolders holders={holders} holderCount={token.holderCount ?? 0} />
        )}
      </div>
    </div>
  );
}
