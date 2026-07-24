"use client";

import { useConnectModal } from "@rainbow-me/rainbowkit";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { decodeEventLog, parseEther, parseUnits } from "viem";
import {
  useAccount,
  useChainId,
  useReadContract,
  useSwitchChain,
  useWaitForTransactionReceipt,
  useWriteContract,
} from "wagmi";

import { ArrowRightIcon, CoinIcon, LockIcon, PlusIcon } from "@/components/icons";
import { erc20Abi } from "@/lib/evm/abi/erc20";
import { stableLaunchpadAbi } from "@/lib/evm/abi/stableLaunchpad";
import {
  activeChain,
  isEvmConfigured,
  launchpadAddress,
  usdt0Address,
} from "@/lib/evm/chains";
import { devBuySupplyPct, quoteDevBuyTokens } from "@/lib/evm/curveMath";

// Flavor 0 = Standard (clean coin). LP-grow and Super LP flavors exist in the
// contract but stay hidden in the UI for now.
const FLAVOR_STANDARD = 0;

type LaunchArgs = {
  name: string;
  symbol: string;
  uri: string;
  salt: `0x${string}`;
  devBuyRaw: bigint;
  minDevBuyTokens: bigint;
};

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3">
      <p className="font-mono text-[11px] font-bold lowercase tracking-wider text-stbl-yolk">
        {"/// "}
        {children}
      </p>
      <div className="h-px flex-1 bg-stbl-800" />
    </div>
  );
}

export function CurveLaunchForm() {
  if (!isEvmConfigured()) {
    return (
      <div className="rounded-2xl border border-dashed border-stbl-700 bg-stbl-900/40 px-6 py-16 text-center">
        <CoinIcon className="mx-auto h-10 w-10 text-stbl-shell/30" />
        <p className="mt-3 font-display text-lg font-extrabold lowercase text-stbl-shell">
          launches aren&apos;t configured on this chain yet
        </p>
        <p className="mt-1 text-sm lowercase text-stbl-shell/60">
          set the launchpad address to enable launching.
        </p>
      </div>
    );
  }
  return <LaunchForm />;
}

function LaunchForm() {
  const router = useRouter();
  const { address: account, isConnected } = useAccount();
  const { openConnectModal } = useConnectModal();
  const chainId = useChainId();
  const { switchChain } = useSwitchChain();
  const chain = activeChain();
  const usdt0 = usdt0Address();

  const [name, setName] = useState("");
  const [symbol, setSymbol] = useState("");
  const [description, setDescription] = useState("");
  const [website, setWebsite] = useState("");
  const [twitter, setTwitter] = useState("");
  const [telegram, setTelegram] = useState("");
  const [devBuy, setDevBuy] = useState("");
  const [image, setImage] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
  const [stage, setStage] = useState<"" | "pin" | "mine" | "approve" | "launch">("");
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement | null>(null);
  // Launch args survive the approve round-trip so the launch fires right after.
  const pendingLaunch = useRef<LaunchArgs | null>(null);

  const { writeContract, data: txHash, isPending, error: writeError, reset } =
    useWriteContract();
  const { data: receipt, isLoading: confirming } = useWaitForTransactionReceipt({
    hash: txHash,
  });

  const wrongChain = isConnected && chainId !== chain.id;

  // Dev buys are pulled from the wallet as ERC20 USDT0 (6 decimals) — the
  // launchpad needs an allowance before launchToken can transferFrom.
  const devBuyRaw = useMemo(() => {
    const n = Number(devBuy);
    if (!Number.isFinite(n) || n <= 0) return 0n;
    try {
      return parseUnits(n.toFixed(6), 6);
    } catch {
      return 0n;
    }
  }, [devBuy]);
  const devBuyNum = Number(devBuy) || 0;

  const { data: usdAllowance, refetch: refetchAllowance } = useReadContract({
    abi: erc20Abi,
    address: usdt0,
    functionName: "allowance",
    args: [account ?? "0x0000000000000000000000000000000000000000", launchpadAddress()],
    query: { enabled: Boolean(account) },
  });

  const fireLaunch = (args: LaunchArgs) => {
    setStage("launch");
    writeContract({
      abi: stableLaunchpadAbi,
      address: launchpadAddress(),
      functionName: "launchToken",
      args: [
        args.name,
        args.symbol,
        args.uri,
        FLAVOR_STANDARD,
        args.salt,
        args.devBuyRaw,
        args.minDevBuyTokens,
      ],
    });
  };

  // Receipt arrivals drive the pipeline: an approve receipt fires the queued
  // launch; a launch receipt carries TokenLaunched with the new address.
  useEffect(() => {
    if (!receipt) return;
    for (const log of receipt.logs) {
      try {
        const decoded = decodeEventLog({
          abi: stableLaunchpadAbi,
          data: log.data,
          topics: log.topics,
        });
        if (decoded.eventName === "TokenLaunched") {
          const tokenAddr = (decoded.args as { token: string }).token;
          router.push(`/coin/${tokenAddr.toLowerCase()}`);
          return;
        }
      } catch {
        /* not our event */
      }
    }
    if (pendingLaunch.current) {
      const args = pendingLaunch.current;
      pendingLaunch.current = null;
      void refetchAllowance();
      reset();
      fireLaunch(args);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [receipt, router]);

  const onPickImage = (file: File | null) => {
    setImage(file);
    if (preview) URL.revokeObjectURL(preview);
    setPreview(file ? URL.createObjectURL(file) : "");
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!isConnected || !account) {
      openConnectModal?.();
      return;
    }
    if (wrongChain) {
      switchChain({ chainId: chain.id });
      return;
    }
    const cleanName = name.trim();
    const cleanSymbol = symbol.trim().toUpperCase();
    if (!cleanName || !cleanSymbol) {
      setError("name and ticker are required.");
      return;
    }

    try {
      setStage("pin");
      const form = new FormData();
      form.set("name", cleanName);
      form.set("symbol", cleanSymbol);
      form.set("description", description.trim());
      form.set("website", website.trim());
      form.set("twitter", twitter.trim());
      form.set("telegram", telegram.trim());
      if (image) form.set("image", image);

      const res = await fetch("/api/curve/pin-metadata", { method: "POST", body: form });
      const pin = (await res.json()) as { ok: boolean; uri?: string; error?: string };
      if (!pin.ok) throw new Error(pin.error ?? "metadata pinning failed");
      const uri = pin.uri ?? "";

      // Mine a CREATE2 salt so the token address ends in …5b1e. The creator
      // is baked into the init code, so the salt is wallet-specific.
      setStage("mine");
      let salt: `0x${string}` = `0x${crypto
        .getRandomValues(new Uint8Array(32))
        .reduce((s, b) => s + b.toString(16).padStart(2, "0"), "")}` as `0x${string}`;
      try {
        const saltRes = await fetch("/api/curve/vanity-salt", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: cleanName,
            symbol: cleanSymbol,
            metadataURI: uri,
            creator: account,
            flavor: "standard",
          }),
        });
        const mined = (await saltRes.json()) as { ok: boolean; salt?: `0x${string}` };
        if (mined.ok && mined.salt) salt = mined.salt;
      } catch {
        /* random salt fallback — launch still works, just without the suffix */
      }

      // The launch + dev buy is one atomic tx, so the quote is deterministic;
      // the 2% haircut only absorbs client-side float drift.
      const minDevBuyTokens =
        devBuyRaw > 0n
          ? parseEther((quoteDevBuyTokens(devBuyNum) * 0.98).toFixed(18))
          : 0n;
      const args: LaunchArgs = {
        name: cleanName,
        symbol: cleanSymbol,
        uri,
        salt,
        devBuyRaw,
        minDevBuyTokens,
      };

      if (devBuyRaw > 0n && (usdAllowance ?? 0n) < devBuyRaw) {
        setStage("approve");
        pendingLaunch.current = args;
        writeContract({
          abi: erc20Abi,
          address: usdt0,
          functionName: "approve",
          args: [launchpadAddress(), devBuyRaw],
        });
      } else {
        fireLaunch(args);
      }
    } catch (err) {
      setStage("");
      setError(err instanceof Error ? err.message : "launch failed");
    }
  };

  const busy = stage === "pin" || stage === "mine" || isPending || confirming;
  const label = !isConnected
    ? "connect wallet"
    : wrongChain
      ? `switch to ${chain.name}`
      : stage === "pin"
        ? "pinning metadata…"
        : stage === "mine"
          ? "mining …5b1e address…"
          : stage === "approve" && (isPending || confirming)
            ? "approving usdt0…"
            : isPending
              ? "confirm in wallet…"
              : confirming
                ? "launching…"
                : devBuyRaw > 0n && (usdAllowance ?? 0n) < devBuyRaw
                  ? "approve + launch"
                  : "launch coin";

  const inputCls =
    "w-full rounded-xl border border-stbl-700 bg-stbl-950 px-3 py-2.5 text-sm text-stbl-shell outline-none transition focus:border-stbl-yolk focus:shadow-[0_0_0_1px_rgba(32,178,170,0.4)]";
  const labelCls =
    "mb-1 block font-mono text-[10px] font-bold lowercase tracking-wider text-stbl-shell/50";

  return (
    <form
      onSubmit={submit}
      className="overflow-hidden rounded-2xl border border-stbl-700 bg-stbl-900/40"
    >
      {/* form header */}
      <div className="flex items-center gap-3 border-b border-stbl-800 bg-stbl-900/70 px-5 py-4">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-stbl-yolk/15 text-stbl-yolk">
          <PlusIcon className="h-4.5 w-4.5" />
        </span>
        <div>
          <p className="font-display text-sm font-extrabold lowercase text-stbl-shell">
            create coin
          </p>
          <p className="font-mono text-[10px] font-bold lowercase text-stbl-shell/45">
            clean erc20 · locked uniswap v3 pool from block one
          </p>
        </div>
      </div>

      <div className="grid gap-6 p-5">
        {/* identity */}
        <div className="space-y-4">
          <SectionLabel>identity</SectionLabel>
          <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
            <div className="space-y-4">
              <div>
                <label className={labelCls}>name</label>
                <input
                  className={inputCls}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  maxLength={64}
                  placeholder="Turbo Turtle"
                />
              </div>
              <div>
                <label className={labelCls}>ticker</label>
                <input
                  className={`${inputCls} font-mono uppercase`}
                  value={symbol}
                  onChange={(e) => setSymbol(e.target.value.replace(/[^a-zA-Z0-9]/g, ""))}
                  maxLength={12}
                  placeholder="TURBO"
                />
              </div>
            </div>
            <div>
              <label className={labelCls}>image</label>
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="flex h-[124px] w-[124px] flex-col items-center justify-center gap-1 overflow-hidden rounded-2xl border-2 border-dashed border-stbl-700 bg-stbl-950/60 text-stbl-shell/40 transition hover:border-stbl-yolk hover:text-stbl-yolk"
              >
                {preview ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={preview} alt="preview" className="h-full w-full object-cover" />
                ) : (
                  <>
                    <svg className="h-6 w-6" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden>
                      <rect x="2" y="2" width="12" height="12" rx="2" />
                      <circle cx="5.8" cy="5.8" r="1.2" />
                      <path d="M2 11l3.4-3.4 2.6 2.6L11.4 6 14 8.6" />
                    </svg>
                    <span className="font-mono text-[9px] lowercase">upload</span>
                  </>
                )}
              </button>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => onPickImage(e.target.files?.[0] ?? null)}
              />
            </div>
          </div>
          <div>
            <label className={labelCls}>description</label>
            <textarea
              className={`${inputCls} min-h-[80px] resize-y`}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={1000}
              placeholder="what's this coin about?"
            />
          </div>
        </div>

        {/* links */}
        <div className="space-y-4">
          <SectionLabel>links (optional)</SectionLabel>
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label className={labelCls}>website</label>
              <input className={inputCls} value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="https://…" />
            </div>
            <div>
              <label className={labelCls}>x / twitter</label>
              <input className={inputCls} value={twitter} onChange={(e) => setTwitter(e.target.value)} placeholder="https://x.com/…" />
            </div>
            <div>
              <label className={labelCls}>telegram</label>
              <input className={inputCls} value={telegram} onChange={(e) => setTelegram(e.target.value)} placeholder="https://t.me/…" />
            </div>
          </div>
        </div>

        {/* dev buy */}
        <div className="space-y-4">
          <SectionLabel>dev buy (optional)</SectionLabel>
          <div className="flex items-center gap-3">
            <div className="relative">
              <input
                className={`${inputCls} max-w-[180px] pr-14 font-mono`}
                value={devBuy}
                onChange={(e) => setDevBuy(e.target.value.replace(",", "."))}
                inputMode="decimal"
                placeholder="0"
              />
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 font-mono text-[10px] font-bold text-stbl-shell/40">
                usdt0
              </span>
            </div>
            <span className="text-xs lowercase text-stbl-shell/55">
              buys the first coins in the launch transaction itself, before any
              sniper can.
            </span>
          </div>
          {devBuyNum > 0 ? (
            <p className="font-mono text-[11px] lowercase text-stbl-yolk">
              ≈{" "}
              {quoteDevBuyTokens(devBuyNum).toLocaleString("en-US", {
                maximumFractionDigits: 0,
              })}{" "}
              coins ({devBuySupplyPct(devBuyNum).toFixed(2)}% of supply)
              {(usdAllowance ?? 0n) < devBuyRaw
                ? " · needs a usdt0 approval first"
                : ""}
            </p>
          ) : null}
        </div>

        <p className="flex items-start gap-2 rounded-xl bg-stbl-950/60 px-3 py-2.5 text-[11px] lowercase leading-relaxed text-stbl-shell/50">
          <LockIcon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-stbl-yolk" />
          <span>
            the whole supply mints into a{" "}
            <strong className="text-stbl-shell/80">
              permanently locked uniswap v3 position
            </strong>
            .
          </span>
        </p>

        {error || writeError ? (
          <p className="break-words rounded-xl bg-red-400/10 px-3 py-2 text-xs lowercase leading-snug text-red-400">
            {error || writeError?.message.split("\n")[0].slice(0, 200)}
          </p>
        ) : null}
      </div>

      {/* footer */}
      <div className="flex flex-wrap items-center gap-4 border-t border-stbl-800 bg-stbl-950/40 px-5 py-4">
        <button
          type="submit"
          disabled={busy}
          className="inline-flex items-center gap-2 rounded-xl bg-stbl-yolk px-6 py-3 text-sm font-extrabold lowercase text-stbl-950 shadow-[0_0_28px_rgba(32,178,170,0.35)] transition hover:brightness-110 disabled:opacity-50 disabled:shadow-none"
        >
          {label} <ArrowRightIcon className="h-4 w-4" />
        </button>
        <p className="font-mono text-[11px] lowercase text-stbl-shell/45">
          free — you only pay gas{devBuyRaw > 0n ? " + your dev buy" : ""} ·
          address ends in <code className="text-stbl-shell/70">…5b1e</code>
        </p>
      </div>
    </form>
  );
}
