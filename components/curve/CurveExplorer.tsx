"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { CurveTokenCard } from "@/components/curve/CurveTokenCard";
import { useCurrency } from "@/components/curve/CurrencyProvider";
import { CrownIcon, GridIcon, MagnetIcon, RowsIcon } from "@/components/icons";
import { ipfsToHttp } from "@/lib/evm/ipfs";
import type { CurveTokenJson } from "@/types/curve";

type Status = "all" | "live" | "graduated";
type Sort = "activity" | "new" | "gainers" | "marketcap" | "volume" | "progress";
type View = "grid" | "table";

// "live" = still climbing the bonding curve toward $12k; "graduated" = past it.
// Either way the coin trades on its locked v3 pool the whole time.
const STATUS_TABS: { key: Status; label: string }[] = [
  { key: "all", label: "all" },
  { key: "live", label: "climbing" },
  { key: "graduated", label: "graduated" },
];

const SORTS: { key: Sort; label: string }[] = [
  { key: "activity", label: "active" },
  { key: "new", label: "new" },
  { key: "gainers", label: "gainers" },
  { key: "marketcap", label: "mcap" },
  { key: "volume", label: "volume" },
];

function timeAgo(iso: string): string {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return `${Math.floor(s)}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}

function ChangePill({ change, trades }: { change: number; trades: number }) {
  if (trades === 0) return <span className="text-stbl-shell/30">—</span>;
  return (
    <span
      className={`rounded-full px-1.5 py-0.5 font-mono text-[10px] font-bold ${
        change >= 0 ? "bg-emerald-400/10 text-emerald-400" : "bg-red-400/10 text-red-400"
      }`}
    >
      {change >= 0 ? "+" : ""}
      {(change * 100).toFixed(1)}%
    </span>
  );
}

/** Sortable column header — clicking applies the matching server sort. */
function Th({
  label,
  sortKey,
  active,
  onSort,
  align = "right",
}: {
  label: string;
  sortKey?: Sort;
  active: boolean;
  onSort: (s: Sort) => void;
  align?: "left" | "right";
}) {
  const base = `px-3 py-2.5 font-mono text-[10px] font-bold lowercase tracking-wider ${
    align === "left" ? "text-left" : "text-right"
  }`;
  if (!sortKey) {
    return <th className={`${base} text-stbl-shell/40`}>{label}</th>;
  }
  return (
    <th className={base}>
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className={`inline-flex items-center gap-1 transition hover:text-stbl-yolk ${
          active ? "text-stbl-yolk" : "text-stbl-shell/40"
        }`}
      >
        {label}
        <span className={active ? "" : "opacity-30"}>▾</span>
      </button>
    </th>
  );
}

export function CurveExplorer() {
  const { fmt } = useCurrency();
  const [tokens, setTokens] = useState<CurveTokenJson[]>([]);
  const [koth, setKoth] = useState<CurveTokenJson | null>(null);
  const [status, setStatus] = useState<Status>("all");
  const [sort, setSort] = useState<Sort>("activity");
  const [view, setView] = useState<View>("grid");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const saved = window.localStorage.getItem("stbl-board-view");
    if (saved === "table" || saved === "grid") setView(saved);
  }, []);

  const changeView = (v: View) => {
    setView(v);
    window.localStorage.setItem("stbl-board-view", v);
  };

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/curve/tokens?status=${status}&sort=${sort}`, {
        cache: "no-store",
      });
      const data = (await res.json()) as {
        tokens?: CurveTokenJson[];
        koth?: CurveTokenJson | null;
      };
      setTokens(data.tokens ?? []);
      setKoth(data.koth ?? null);
    } catch {
      /* keep previous state */
    } finally {
      setLoading(false);
    }
  }, [status, sort]);

  useEffect(() => {
    setLoading(true);
    void load();
    const id = setInterval(() => void load(), 8_000);
    return () => clearInterval(id);
  }, [load]);

  const pillCls = (active: boolean) =>
    `rounded-lg px-3 py-1.5 text-xs font-bold lowercase transition ${
      active
        ? "bg-stbl-yolk/25 text-stbl-shell"
        : "text-stbl-shell/55 hover:text-stbl-shell"
    }`;

  return (
    <section>
      {koth && koth.phase === "trading" ? (
        <Link
          href={`/coin/${koth.address}`}
          className="mb-6 flex items-center gap-4 rounded-2xl border border-stbl-yolk/50 bg-gradient-to-r from-stbl-yolk/10 via-stbl-900 to-stbl-900 p-4 shadow-md transition hover:border-stbl-yolk"
        >
          <CrownIcon className="h-7 w-7 shrink-0 text-stbl-yolk" />
          {koth.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={ipfsToHttp(koth.imageUrl)}
              alt=""
              className="h-12 w-12 rounded-xl object-cover"
            />
          ) : (
            <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-stbl-yolk/25 font-display text-base font-extrabold text-stbl-yolk">
              {koth.symbol.slice(0, 3)}
            </span>
          )}
          <div className="min-w-0">
            <p className="font-mono text-[10px] font-bold lowercase tracking-wider text-stbl-orange">
              lead coin
            </p>
            <p className="truncate font-display text-base font-extrabold text-stbl-shell">
              {koth.name}{" "}
              <span className="font-mono text-xs text-stbl-shell/60">{koth.symbol}</span>
            </p>
          </div>
          <div className="ml-auto text-right">
            <p className="font-mono text-sm font-bold text-stbl-yolk">
              {Math.round(koth.progress * 100)}%
            </p>
            <p className="text-[10px] lowercase text-stbl-shell/50">to graduation</p>
          </div>
        </Link>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex rounded-xl border border-stbl-700 bg-stbl-900/60 p-1">
          {STATUS_TABS.map((t) => (
            <button key={t.key} type="button" onClick={() => setStatus(t.key)} className={pillCls(status === t.key)}>
              {t.label}
            </button>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-2">
          <div className="flex rounded-xl border border-stbl-700 bg-stbl-900/60 p-1">
            {SORTS.map((s) => (
              <button key={s.key} type="button" onClick={() => setSort(s.key)} className={pillCls(sort === s.key)}>
                {s.label}
              </button>
            ))}
          </div>
          <div className="flex rounded-xl border border-stbl-700 bg-stbl-900/60 p-1">
            <button
              type="button"
              onClick={() => changeView("table")}
              aria-label="table view"
              className={`rounded-lg p-1.5 transition ${view === "table" ? "bg-stbl-yolk/25 text-stbl-shell" : "text-stbl-shell/50 hover:text-stbl-shell"}`}
            >
              <RowsIcon className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => changeView("grid")}
              aria-label="grid view"
              className={`rounded-lg p-1.5 transition ${view === "grid" ? "bg-stbl-yolk/25 text-stbl-shell" : "text-stbl-shell/50 hover:text-stbl-shell"}`}
            >
              <GridIcon className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {loading && tokens.length === 0 ? (
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-44 animate-pulse rounded-2xl border border-stbl-700 bg-stbl-800/40" />
          ))}
        </div>
      ) : tokens.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-dashed border-stbl-700 bg-stbl-800/30 px-6 py-14 text-center">
          <MagnetIcon className="mx-auto h-10 w-10 text-stbl-shell/30" />
          <p className="mt-3 font-display text-lg font-extrabold lowercase text-stbl-shell">
            nothing here yet
          </p>
          <p className="mt-1 text-sm lowercase text-stbl-shell/60">
            be the first to launch a coin on stable.
          </p>
          <Link
            href="/launch"
            className="mt-5 inline-flex items-center rounded-xl bg-stbl-yolk px-5 py-2.5 text-sm font-bold lowercase text-stbl-950 shadow-md transition hover:brightness-110"
          >
            launch the first coin
          </Link>
        </div>
      ) : view === "grid" ? (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {tokens.map((t) => (
            <CurveTokenCard key={t.address} token={t} />
          ))}
        </div>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-2xl border border-stbl-700 bg-stbl-900/60">
          <table className="w-full min-w-[860px] text-left text-sm">
            <thead>
              <tr className="border-b border-stbl-800">
                <Th label="coin" active={false} onSort={setSort} align="left" />
                <Th label="price" sortKey="marketcap" active={sort === "marketcap"} onSort={setSort} />
                <Th label="progress" sortKey="progress" active={sort === "progress"} onSort={setSort} />
                <Th label="mcap" sortKey="marketcap" active={sort === "marketcap"} onSort={setSort} />
                <Th label="24h vol" sortKey="volume" active={sort === "volume"} onSort={setSort} />
                <Th label="24h" sortKey="gainers" active={sort === "gainers"} onSort={setSort} />
                <Th label="age" sortKey="new" active={sort === "new"} onSort={setSort} />
              </tr>
            </thead>
            <tbody>
              {tokens.map((t) => (
                <tr
                  key={t.address}
                  className="group border-b border-stbl-800/60 transition last:border-0 hover:bg-stbl-800/40"
                >
                  <td className="px-3 py-2.5">
                    <Link href={`/coin/${t.address}`} className="flex min-w-0 items-center gap-2.5">
                      {t.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={ipfsToHttp(t.imageUrl)} alt="" className="h-8 w-8 shrink-0 rounded-lg object-cover" />
                      ) : (
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-stbl-yolk/20 font-mono text-[10px] font-extrabold text-stbl-yolk">
                          {t.symbol.slice(0, 3)}
                        </span>
                      )}
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-bold text-stbl-shell group-hover:text-stbl-yolk">
                          {t.name}
                        </span>
                        <span className="block font-mono text-[10px] text-stbl-shell/50">
                          {t.symbol}
                        </span>
                      </span>
                    </Link>
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono text-xs text-stbl-shell/85">
                    ${t.priceUsd < 0.001 ? t.priceUsd.toExponential(2) : t.priceUsd.toFixed(4)}
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    {t.phase === "trading" ? (
                      <span className="inline-flex items-center justify-end gap-2">
                        <span className="h-1.5 w-16 overflow-hidden rounded-full bg-stbl-800">
                          <span
                            className="block h-full rounded-full bg-gradient-to-r from-stbl-yolk to-stbl-orange"
                            style={{ width: `${Math.max(3, Math.round(t.progress * 100))}%` }}
                          />
                        </span>
                        <span className="font-mono text-[10px] text-stbl-orange">
                          {Math.round(t.progress * 100)}%
                        </span>
                      </span>
                    ) : (
                      <span className="font-mono text-[10px] font-bold lowercase text-emerald-400">
                        graduated
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono text-xs font-bold text-stbl-shell">
                    {fmt(t.marketCapUsd)}
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono text-xs text-stbl-shell/75">
                    {fmt(t.volumeUsd)}
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    <ChangePill change={t.change24h} trades={t.tradeCount} />
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono text-[11px] text-stbl-shell/50">
                    {timeAgo(t.createdAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
