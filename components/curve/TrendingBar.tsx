"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { useCurrency } from "@/components/curve/CurrencyProvider";
import { ipfsToHttp } from "@/lib/evm/ipfs";
import type { CurveTokenJson } from "@/types/curve";

type TrendingToken = CurveTokenJson & { windowVolumeUsd: number };

/** "trending now" — the coins with the most volume in the last 5 minutes,
 * image-forward cards in a horizontal strip. Hidden when the window is quiet. */
export function TrendingBar() {
  const { fmt } = useCurrency();
  const [tokens, setTokens] = useState<TrendingToken[]>([]);
  const [window_, setWindow] = useState<"5m" | "24h">("5m");

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/curve/trending", { cache: "no-store" });
      const data = (await res.json()) as {
        window?: "5m" | "24h";
        tokens?: TrendingToken[];
      };
      setTokens(data.tokens ?? []);
      setWindow(data.window ?? "5m");
    } catch {
      /* keep last */
    }
  }, []);

  useEffect(() => {
    void load();
    const id = setInterval(() => void load(), 10_000);
    return () => clearInterval(id);
  }, [load]);

  if (tokens.length === 0) return null;

  return (
    <section>
      <h2 className="mb-3 font-display text-lg font-extrabold lowercase text-stbl-shell">
        trending now
      </h2>
      {/* NOTE: overflow-x-auto forces overflow-y to clip too, so cards must
       * not translate on hover — anything that moves gets cut at the edge. */}
      <div className="flex gap-3 overflow-x-auto pb-2">
        {tokens.map((t) => (
          <Link
            key={t.address}
            href={`/coin/${t.address}`}
            className="group w-[220px] shrink-0 overflow-hidden rounded-2xl border border-stbl-700 bg-stbl-900/60 transition hover:border-stbl-yolk/70 hover:shadow-[0_0_20px_rgba(32,178,170,0.15)]"
          >
            <div className="relative h-[130px] w-full overflow-hidden bg-stbl-800">
              {t.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={ipfsToHttp(t.imageUrl)}
                  alt=""
                  className="h-full w-full object-cover transition group-hover:scale-105"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center font-display text-3xl font-extrabold text-stbl-yolk/40">
                  {t.symbol.slice(0, 3)}
                </div>
              )}
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-stbl-950/95 via-stbl-950/60 to-transparent px-3 pb-2 pt-8">
                <p className="font-mono text-base font-bold text-stbl-shell">
                  {fmt(t.marketCapUsd)}
                </p>
                <p className="truncate text-sm font-bold text-stbl-shell">
                  {t.name}{" "}
                  <span className="font-mono text-[10px] font-semibold text-stbl-shell/60">
                    {t.symbol}
                  </span>
                </p>
              </div>
            </div>
            <p className="truncate px-3 py-2 text-xs lowercase text-stbl-shell/55">
              {t.description || `${fmt(t.windowVolumeUsd)} traded · ${window_}`}
            </p>
          </Link>
        ))}
      </div>
    </section>
  );
}
