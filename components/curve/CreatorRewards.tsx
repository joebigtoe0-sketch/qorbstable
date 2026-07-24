"use client";

import { useEffect, useState } from "react";
import {
  useAccount,
  useReadContract,
  useWaitForTransactionReceipt,
  useWriteContract,
} from "wagmi";

import { stableLaunchTokenAbi } from "@/lib/evm/abi/stableLaunchToken";
import { stableLockerAbi } from "@/lib/evm/abi/stableLocker";
import type { CurveTokenJson } from "@/types/curve";

/**
 * Shown on a coin page only when the connected wallet created the token.
 * The locked v3 position's 1% pool fee accrues to the StableLocker; collect()
 * is permissionless, auto-sells the token-side fees into the pool (so the
 * sale is attributed to the locker, never the creator's wallet), and pushes
 * the creator's 50% share straight to their wallet in USDT0 — nothing
 * custodied, nothing to claim later.
 */
export function CreatorRewards({ token }: { token: CurveTokenJson }) {
  const { address: account } = useAccount();
  const [collected, setCollected] = useState(false);

  const isCreator = Boolean(
    account && account.toLowerCase() === token.creator.toLowerCase()
  );

  // Each token stores its own locker (immutable) — correct even for coins
  // launched by a retired launchpad generation.
  const { data: locker } = useReadContract({
    abi: stableLaunchTokenAbi,
    address: token.address as `0x${string}`,
    functionName: "locker",
    query: { enabled: isCreator },
  });

  const { writeContract, data: txHash, isPending, error: writeError } =
    useWriteContract();
  const { isLoading: confirming, isSuccess: confirmed } =
    useWaitForTransactionReceipt({ hash: txHash });

  useEffect(() => {
    if (confirmed) {
      setCollected(true);
      const id = setTimeout(() => setCollected(false), 6_000);
      return () => clearTimeout(id);
    }
  }, [confirmed]);

  if (!isCreator) return null;

  const busy = isPending || confirming;

  return (
    <div className="rounded-2xl border border-stbl-yolk/30 bg-stbl-yolk/10 p-4">
      <p className="text-[10px] font-bold lowercase tracking-wider text-stbl-yolk">
        creator rewards
      </p>

      <div className="mt-3 flex items-center justify-between gap-3">
        <p className="text-[11px] leading-relaxed text-stbl-shell/60">
          Your coin&apos;s locked pool charges a 1% fee on every trade —{" "}
          <span className="font-bold text-stbl-shell/85">half of it is yours</span>
          . Collecting sends your share straight to your wallet, all in USDT0.
        </p>
        <button
          type="button"
          disabled={busy || !locker}
          onClick={() =>
            locker &&
            writeContract({
              abi: stableLockerAbi,
              address: locker,
              functionName: "collect",
              args: [token.address as `0x${string}`],
            })
          }
          className="shrink-0 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-emerald-500 disabled:opacity-40"
        >
          {busy ? "Collecting…" : collected ? "Collected" : "Collect"}
        </button>
      </div>

      {writeError ? (
        <p className="mt-2 break-words text-[11px] leading-snug text-red-400">
          {writeError.message.split("\n")[0].slice(0, 160)}
        </p>
      ) : null}

      <p className="mt-3 border-t border-stbl-yolk/20 pt-3 text-[11px] text-stbl-shell/50">
        Fees accrue in the position between collections — anyone can trigger a
        collection, and your share always lands in your wallet as dollars (the
        coin-side fees are sold by the locker itself, so your wallet never
        shows up as a seller). Forever; the position can never be withdrawn.
      </p>
    </div>
  );
}
