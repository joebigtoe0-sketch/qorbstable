"use client";

import { useConnectModal } from "@rainbow-me/rainbowkit";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useAccount } from "wagmi";

import { useCurrency } from "@/components/curve/CurrencyProvider";
import { WalletIcon } from "@/components/icons";
import { ipfsToHttp } from "@/lib/evm/ipfs";
import type { CurveTokenJson } from "@/types/curve";

type Holding = { token: CurveTokenJson; balance: string; valueUsd: number };

function phaseLabel(token: CurveTokenJson): string {
  if (token.phase === "graduated") return "graduated";
  return `climbing ${Math.round(token.progress * 100)}%`;
}

function TokenBadge({ token }: { token: CurveTokenJson }) {
  return (
    <Link href={`/coin/${token.address}`} className="flex min-w-0 items-center gap-2.5">
      {token.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={ipfsToHttp(token.imageUrl)}
          alt=""
          className="h-9 w-9 shrink-0 rounded-lg object-cover"
        />
      ) : (
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-stbl-yolk/20 text-[11px] font-extrabold text-stbl-yolk">
          {token.symbol.slice(0, 3)}
        </span>
      )}
      <span className="min-w-0">
        <span className="flex items-center gap-1.5">
          <span className="block truncate text-sm font-bold text-stbl-ink hover:text-stbl-yolk dark:text-stbl-shell">
            {token.name}
          </span>
        </span>
        <span className="block font-mono text-[10px] text-stbl-wood/60 dark:text-stbl-shell/50">
          {token.symbol} · {phaseLabel(token)}
        </span>
      </span>
    </Link>
  );
}

export function PortfolioClient() {
  const { address: account, isConnected } = useAccount();
  const { openConnectModal } = useConnectModal();
  const { fmt } = useCurrency();

  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [created, setCreated] = useState<CurveTokenJson[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!account) return;
    try {
      const res = await fetch(`/api/curve/portfolio/${account.toLowerCase()}`, {
        cache: "no-store",
      });
      const data = (await res.json()) as { holdings?: Holding[]; created?: CurveTokenJson[] };
      setHoldings(data.holdings ?? []);
      setCreated(data.created ?? []);
    } catch {
      /* transient */
    } finally {
      setLoading(false);
    }
  }, [account]);

  useEffect(() => {
    setLoading(true);
    void load();
    const id = setInterval(() => void load(), 10_000);
    return () => clearInterval(id);
  }, [load]);

  if (!isConnected) {
    return (
      <div className="rounded-2xl border border-dashed border-stbl-straw/50 bg-stbl-surface-warm/30 px-6 py-16 text-center dark:border-stbl-700 dark:bg-stbl-800/30">
        <p className="text-4xl" aria-hidden>
          <WalletIcon className="mx-auto h-10 w-10 text-stbl-shell/30" />
        </p>
        <p className="mt-3 font-display text-lg font-extrabold text-stbl-ink dark:text-stbl-shell">
          Connect a wallet to see your portfolio
        </p>
        <p className="mt-1 text-sm text-stbl-wood/70 dark:text-stbl-shell/60">
          Holdings, tokens you created, and claimable fees all live here.
        </p>
        <button
          type="button"
          onClick={() => openConnectModal?.()}
          className="mt-5 rounded-xl bg-stbl-yolk px-5 py-2.5 text-sm font-bold text-stbl-950 transition hover:brightness-110"
        >
          Connect wallet
        </button>
      </div>
    );
  }

  const totalValue = holdings.reduce((s, h) => s + h.valueUsd, 0);
  const createdVolume = created.reduce((s, t) => s + t.volumeUsd, 0);

  return (
    <div className="space-y-6 pb-8">
      {/* summary row */}
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-stbl-straw/40 bg-stbl-surface p-4 dark:border-stbl-700 dark:bg-stbl-900/60">
          <p className="text-[10px] font-bold lowercase tracking-wider text-stbl-wood/60 dark:text-stbl-shell/50">
            Holdings value
          </p>
          <p className="mt-1 font-mono text-xl font-bold text-stbl-ink dark:text-stbl-shell">
            {fmt(totalValue)}
          </p>
        </div>
        <div className="rounded-2xl border border-stbl-straw/40 bg-stbl-surface p-4 dark:border-stbl-700 dark:bg-stbl-900/60">
          <p className="text-[10px] font-bold lowercase tracking-wider text-stbl-wood/60 dark:text-stbl-shell/50">
            Tokens held / created
          </p>
          <p className="mt-1 font-mono text-xl font-bold text-stbl-ink dark:text-stbl-shell">
            {holdings.length} / {created.length}
          </p>
        </div>
        <div className="rounded-2xl border border-stbl-straw/40 bg-stbl-surface p-4 dark:border-stbl-700 dark:bg-stbl-900/60">
          <p className="text-[10px] font-bold lowercase tracking-wider text-stbl-wood/60 dark:text-stbl-shell/50">
            Volume on your coins
          </p>
          <p className="mt-1 font-mono text-xl font-bold text-stbl-ink dark:text-stbl-shell">
            {fmt(createdVolume)}
          </p>
          <p className="mt-0.5 text-[10px] lowercase text-stbl-wood/55 dark:text-stbl-shell/45">
            half the 1% pool fee is yours — collect it on each coin&apos;s page
          </p>
        </div>
      </div>

      {/* holdings */}
      <section>
        <h2 className="font-display text-sm font-bold lowercase tracking-wide text-stbl-wood/80 dark:text-stbl-shell/70">
          Holdings
        </h2>
        {loading && holdings.length === 0 ? (
          <div className="mt-3 h-24 animate-pulse rounded-2xl bg-stbl-surface-warm/40 dark:bg-stbl-800/40" />
        ) : holdings.length === 0 ? (
          <div className="mt-3 rounded-2xl border border-dashed border-stbl-straw/50 bg-stbl-surface-warm/30 px-5 py-8 text-center text-sm text-stbl-wood/70 dark:border-stbl-700 dark:bg-stbl-800/30 dark:text-stbl-shell/60">
            No tokens yet —{" "}
            <Link href="/" className="font-semibold underline hover:text-stbl-yolk">
              browse the launchpad
            </Link>{" "}
            to find one.
          </div>
        ) : (
          <div className="mt-3 overflow-hidden rounded-2xl border border-stbl-straw/40 bg-stbl-surface dark:border-stbl-700 dark:bg-stbl-900/60">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-stbl-straw/30 text-[10px] lowercase tracking-wider text-stbl-wood/50 dark:border-stbl-800 dark:text-stbl-shell/40">
                  <th className="px-4 py-2.5 font-semibold">Token</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Mcap</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Balance</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Value</th>
                </tr>
              </thead>
              <tbody>
                {holdings.map((h) => (
                  <tr
                    key={h.token.address}
                    className="border-b border-stbl-straw/20 last:border-0 dark:border-stbl-800"
                  >
                    <td className="px-4 py-2.5">
                      <TokenBadge token={h.token} />
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono text-xs">
                      {fmt(h.token.marketCapUsd)}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono text-xs">
                      {(Number(h.balance) / 1e18).toLocaleString("en-US", {
                        maximumFractionDigits: 0,
                      })}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono text-xs font-bold">
                      {fmt(h.valueUsd)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* created tokens */}
      <section>
        <h2 className="font-display text-sm font-bold lowercase tracking-wide text-stbl-wood/80 dark:text-stbl-shell/70">
          Created by you
        </h2>
        {created.length === 0 ? (
          <div className="mt-3 rounded-2xl border border-dashed border-stbl-straw/50 bg-stbl-surface-warm/30 px-5 py-8 text-center text-sm text-stbl-wood/70 dark:border-stbl-700 dark:bg-stbl-800/30 dark:text-stbl-shell/60">
            Nothing launched yet —{" "}
            <Link href="/launch" className="font-semibold underline hover:text-stbl-yolk">
              launch your first token
            </Link>
            . You earn 0.5% of every curve trade on your launches, claimable
            any time.
          </div>
        ) : (
          <div className="mt-3 overflow-hidden rounded-2xl border border-stbl-straw/40 bg-stbl-surface dark:border-stbl-700 dark:bg-stbl-900/60">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-stbl-straw/30 text-[10px] lowercase tracking-wider text-stbl-wood/50 dark:border-stbl-800 dark:text-stbl-shell/40">
                  <th className="px-4 py-2.5 font-semibold">Token</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Mcap</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Raised</th>
                </tr>
              </thead>
              <tbody>
                {created.map((t) => (
                  <tr
                    key={t.address}
                    className="border-b border-stbl-straw/20 last:border-0 dark:border-stbl-800"
                  >
                    <td className="px-4 py-2.5">
                      <TokenBadge token={t} />
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono text-xs">
                      {fmt(t.marketCapUsd)}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono text-xs">
                      {fmt(t.raisedUsd)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
