"use client";

import { useConnectModal } from "@rainbow-me/rainbowkit";
import { useEffect, useMemo, useState } from "react";
import { formatEther, formatUnits, maxUint256, parseEther, parseUnits } from "viem";
import {
  useAccount,
  useChainId,
  useReadContract,
  useSwitchChain,
  useWaitForTransactionReceipt,
  useWriteContract,
} from "wagmi";

import { useCurrency } from "@/components/curve/CurrencyProvider";
import { SealCheckIcon } from "@/components/icons";
import { erc20Abi } from "@/lib/evm/abi/erc20";
import { stableLaunchTokenAbi } from "@/lib/evm/abi/stableLaunchToken";
import { stableRouterAbi } from "@/lib/evm/abi/stableRouter";
import { uniswapV3PoolAbi } from "@/lib/evm/abi/uniswapV3Pool";
import {
  activeChain,
  explorerUrl,
  routerAddress,
  usdt0Address,
} from "@/lib/evm/chains";
import { POOL_FEE_TIER, quotePoolSwap } from "@/lib/evm/curveMath";
import type { CurveTokenJson } from "@/types/curve";

const SLIPPAGE_PRESETS = [0.5, 1, 2, 5];
const USD_PRESETS = ["10", "50", "100", "500"];
const ZERO_ADDR = "0x0000000000000000000000000000000000000000" as const;

/**
 * The one and only trade panel: every token trades on its locked Uniswap v3
 * pool from block one, through our router (approve-gated USDT0 on buys, the
 * token itself on sells). Graduation is a badge, not a phase change — the
 * panel never switches venue.
 */
export function CurveTradeWidget({
  token,
  onTraded,
}: {
  token: CurveTokenJson;
  onTraded?: () => void;
}) {
  const { address: account, isConnected } = useAccount();
  const { openConnectModal } = useConnectModal();
  const chainId = useChainId();
  const { switchChain } = useSwitchChain();
  const { fmt } = useCurrency();

  const [tab, setTab] = useState<"buy" | "sell">("buy");
  const [amount, setAmount] = useState("");
  const [slippagePct, setSlippagePct] = useState(2);
  const [customSlippage, setCustomSlippage] = useState("");

  useEffect(() => {
    const saved = Number(window.localStorage.getItem("stbl-slippage-pct"));
    if (saved > 0 && saved <= 50) {
      setSlippagePct(saved);
      if (!SLIPPAGE_PRESETS.includes(saved)) setCustomSlippage(String(saved));
    }
  }, []);

  const chain = activeChain();
  const router = routerAddress();
  const usdt0 = usdt0Address();
  const tokenAddr = token.address as `0x${string}`;
  const poolAddr = (token.pair || ZERO_ADDR) as `0x${string}`;
  // Pool token ordering is deterministic from the addresses.
  const tokenIs0 = token.address.toLowerCase() < usdt0.toLowerCase();
  const wrongChain = isConnected && chainId !== chain.id;

  const setSlippage = (pct: number) => {
    if (!(pct > 0) || pct > 50) return;
    setSlippagePct(pct);
    window.localStorage.setItem("stbl-slippage-pct", String(pct));
  };

  const applySlippage = (v: bigint): bigint => {
    const bps = BigInt(Math.round(slippagePct * 100));
    return (v * (10_000n - bps)) / 10_000n;
  };

  // USDT0 is the 6-decimal ERC20; launch tokens are 18-decimal.
  const buyUsdRaw = useMemo(() => {
    if (tab !== "buy") return 0n;
    const n = Number(amount);
    if (!Number.isFinite(n) || n <= 0) return 0n;
    try {
      return parseUnits(n.toFixed(6), 6);
    } catch {
      return 0n;
    }
  }, [amount, tab]);

  const sellTokens = useMemo(() => {
    if (tab !== "sell") return 0n;
    try {
      return parseEther(amount || "0");
    } catch {
      return 0n;
    }
  }, [amount, tab]);

  // Live pool state for client-side quotes. (eth_call simulation quotes don't
  // work here — buys are approve-gated transferFrom pulls.)
  const { data: slot0 } = useReadContract({
    abi: uniswapV3PoolAbi,
    address: poolAddr,
    functionName: "slot0",
    query: { enabled: poolAddr !== ZERO_ADDR, refetchInterval: 4_000 },
  });
  const { data: liquidity } = useReadContract({
    abi: uniswapV3PoolAbi,
    address: poolAddr,
    functionName: "liquidity",
    query: { enabled: poolAddr !== ZERO_ADDR, refetchInterval: 4_000 },
  });

  const quote = useMemo(() => {
    if (!slot0 || liquidity === undefined) return 0;
    const amountIn = tab === "buy" ? Number(buyUsdRaw) / 1e6 : Number(sellTokens) / 1e18;
    if (!(amountIn > 0)) return 0;
    return quotePoolSwap({
      sqrtPriceX96: slot0[0],
      liquidity,
      tokenIs0,
      direction: tab,
      amountIn,
    });
  }, [slot0, liquidity, tab, buyUsdRaw, sellTokens, tokenIs0]);

  const { data: tokenBalance, refetch: refetchTokenBalance } = useReadContract({
    abi: stableLaunchTokenAbi,
    address: tokenAddr,
    functionName: "balanceOf",
    args: [account ?? ZERO_ADDR],
    query: { enabled: Boolean(account) },
  });

  const { data: usdBalance, refetch: refetchUsdBalance } = useReadContract({
    abi: erc20Abi,
    address: usdt0,
    functionName: "balanceOf",
    args: [account ?? ZERO_ADDR],
    query: { enabled: Boolean(account) },
  });

  const { data: usdAllowance, refetch: refetchUsdAllowance } = useReadContract({
    abi: erc20Abi,
    address: usdt0,
    functionName: "allowance",
    args: [account ?? ZERO_ADDR, router],
    query: { enabled: Boolean(account) },
  });

  const { data: tokenAllowance, refetch: refetchTokenAllowance } = useReadContract({
    abi: stableLaunchTokenAbi,
    address: tokenAddr,
    functionName: "allowance",
    args: [account ?? ZERO_ADDR, router],
    query: { enabled: Boolean(account) },
  });

  const { writeContract, data: txHash, isPending, error: writeError, reset } =
    useWriteContract();
  const { isLoading: confirming, isSuccess: confirmed } =
    useWaitForTransactionReceipt({ hash: txHash });

  const needsUsdApproval =
    tab === "buy" && buyUsdRaw > 0n && (usdAllowance ?? 0n) < buyUsdRaw;
  const needsTokenApproval =
    tab === "sell" && sellTokens > 0n && (tokenAllowance ?? 0n) < sellTokens;
  const approving = needsUsdApproval || needsTokenApproval;

  useEffect(() => {
    if (confirmed) {
      reset();
      void refetchUsdAllowance();
      void refetchTokenAllowance();
      void refetchTokenBalance();
      void refetchUsdBalance();
      // Keep the typed amount after an approval so the swap is one tap away;
      // clear it after the actual trade.
      if (!approving) {
        setAmount("");
        onTraded?.();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [confirmed]);

  const busy = isPending || confirming;

  const submit = () => {
    if (!isConnected) {
      openConnectModal?.();
      return;
    }
    if (wrongChain) {
      switchChain({ chainId: chain.id });
      return;
    }
    if (needsUsdApproval) {
      writeContract({
        abi: erc20Abi,
        address: usdt0,
        functionName: "approve",
        args: [router, maxUint256],
      });
    } else if (needsTokenApproval) {
      writeContract({
        abi: stableLaunchTokenAbi,
        address: tokenAddr,
        functionName: "approve",
        args: [router, maxUint256],
      });
    } else if (tab === "buy") {
      if (buyUsdRaw === 0n || !(quote > 0)) return;
      const minTokens = applySlippage(parseEther(quote.toFixed(18)));
      writeContract({
        abi: stableRouterAbi,
        address: router,
        functionName: "buyExactUsd",
        args: [tokenAddr, POOL_FEE_TIER, buyUsdRaw, minTokens, account!],
      });
    } else {
      if (sellTokens === 0n || !(quote > 0)) return;
      const minUsd = applySlippage(parseUnits(quote.toFixed(6), 6));
      writeContract({
        abi: stableRouterAbi,
        address: router,
        functionName: "sellExactTokens",
        args: [tokenAddr, POOL_FEE_TIER, sellTokens, minUsd, account!],
      });
    }
  };

  const label = !isConnected
    ? "connect wallet"
    : wrongChain
      ? `switch to ${chain.name}`
      : busy
        ? "confirming…"
        : needsUsdApproval || needsTokenApproval
          ? "approve"
          : tab === "buy"
            ? "buy"
            : "sell";

  return (
    <div className="space-y-4">
      {token.phase === "graduated" ? (
        <div className="rounded-2xl border border-emerald-500/40 bg-emerald-500/10 p-4 text-center">
          <p className="flex items-center justify-center gap-2 font-display text-sm font-extrabold lowercase text-stbl-shell">
            <SealCheckIcon className="h-5 w-5 text-emerald-400" />
            graduated. same pool, bigger league.
          </p>
          <p className="mt-1 text-[11px] lowercase leading-relaxed text-stbl-shell/60">
            liquidity locked forever in uniswap v3
            {token.pair ? (
              <>
                {" · "}
                <a
                  href={explorerUrl("address", token.pair)}
                  target="_blank"
                  rel="noreferrer"
                  className="underline hover:text-stbl-yolk"
                >
                  pool contract ↗
                </a>
              </>
            ) : null}
          </p>
        </div>
      ) : null}

      <div className="rounded-2xl border border-stbl-straw/40 bg-stbl-surface p-4 dark:border-stbl-700 dark:bg-stbl-900/60">
        <div className="flex rounded-xl border border-stbl-straw/40 p-1 dark:border-stbl-700">
          {(["buy", "sell"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => {
                setTab(t);
                setAmount("");
              }}
              className={`flex-1 rounded-lg px-3 py-2 text-sm font-bold lowercase transition ${
                tab === t
                  ? t === "buy"
                    ? "bg-emerald-500/20 text-emerald-400"
                    : "bg-red-500/15 text-red-400"
                  : "text-stbl-shell/50"
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        <div className="mt-4">
          <div className="flex items-center justify-between text-[11px] text-stbl-shell/55">
            {tab === "buy" ? (
              <span>Spend (USDT0)</span>
            ) : (
              <span>Sell ({token.symbol})</span>
            )}
            {tab === "buy" && usdBalance !== undefined ? (
              <button
                type="button"
                className="font-mono underline decoration-dotted"
                onClick={() => setAmount(formatUnits(usdBalance, 6))}
              >
                max ${Number(formatUnits(usdBalance, 6)).toLocaleString("en-US", { maximumFractionDigits: 2 })}
              </button>
            ) : null}
            {tab === "sell" && tokenBalance !== undefined ? (
              <button
                type="button"
                className="font-mono underline decoration-dotted"
                onClick={() => setAmount(formatEther(tokenBalance))}
              >
                max {Number(formatEther(tokenBalance)).toLocaleString("en-US", { maximumFractionDigits: 0 })}
              </button>
            ) : null}
          </div>
          <div className="relative mt-1">
            <input
              value={amount}
              onChange={(e) => setAmount(e.target.value.replace(",", "."))}
              inputMode="decimal"
              placeholder="0.0"
              className="w-full rounded-xl border border-stbl-straw/50 bg-stbl-canvas px-3 py-2.5 pr-16 font-mono text-lg font-semibold text-stbl-ink outline-none transition focus:border-stbl-yolk dark:border-stbl-700 dark:bg-stbl-950 dark:text-stbl-shell"
            />
            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-stbl-shell/40">
              {tab === "buy" ? "USDT0" : token.symbol}
            </span>
          </div>
          {tab === "buy" ? (
            <div className="mt-1 flex gap-1.5">
              {USD_PRESETS.map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setAmount(v)}
                  className="rounded-lg border border-stbl-straw/40 px-2 py-1 text-[11px] font-bold text-stbl-shell/60 transition hover:border-stbl-yolk dark:border-stbl-700"
                >
                  ${v}
                </button>
              ))}
            </div>
          ) : (
            <div className="mt-1 flex gap-1.5">
              {[25, 50, 100].map((pct) => (
                <button
                  key={pct}
                  type="button"
                  onClick={() => {
                    if (tokenBalance !== undefined) {
                      setAmount(formatEther((tokenBalance * BigInt(pct)) / 100n));
                    }
                  }}
                  className="rounded-lg border border-stbl-straw/40 px-2 py-1 text-[11px] font-bold text-stbl-shell/60 transition hover:border-stbl-yolk dark:border-stbl-700"
                >
                  {pct}%
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="mt-3 rounded-xl bg-stbl-surface-warm/50 px-3 py-2 text-xs text-stbl-shell/65 dark:bg-stbl-800/50">
          {quote > 0 ? (
            <>
              <div className="flex justify-between">
                <span>You receive ≈</span>
                <span className="font-mono font-bold">
                  {tab === "buy"
                    ? `${quote.toLocaleString("en-US", { maximumFractionDigits: 0 })} ${token.symbol}`
                    : fmt(quote)}
                </span>
              </div>
              {tab === "buy" && needsUsdApproval ? (
                <p className="mt-1 text-[10px] text-stbl-shell/50">
                  first tap approves usdt0 for the router, second executes the buy.
                </p>
              ) : null}
              {token.flavor === "superLp" && tab === "buy" ? (
                <p className="mt-1 text-[10px] text-stbl-orange">
                  super lp coin — a 5% buy tax compounds into the locked pool.
                </p>
              ) : null}
            </>
          ) : (
            <span>Enter an amount to see the quote (1% pool fee included).</span>
          )}
        </div>

        {/* slippage */}
        <div className="mt-3 flex items-center gap-1.5 text-[11px]">
          <span className="text-stbl-shell/50">Slippage</span>
          {SLIPPAGE_PRESETS.map((pct) => (
            <button
              key={pct}
              type="button"
              onClick={() => {
                setSlippage(pct);
                setCustomSlippage("");
              }}
              className={`rounded-md border px-1.5 py-0.5 font-bold transition ${
                slippagePct === pct && customSlippage === ""
                  ? "border-stbl-yolk bg-stbl-yolk/20 text-stbl-shell"
                  : "border-stbl-straw/40 text-stbl-shell/50 hover:border-stbl-yolk dark:border-stbl-700"
              }`}
            >
              {pct}%
            </button>
          ))}
          <div className="relative">
            <input
              value={customSlippage}
              onChange={(e) => {
                const v = e.target.value.replace(",", ".").replace(/[^0-9.]/g, "");
                setCustomSlippage(v);
                const n = Number(v);
                if (n > 0 && n <= 50) setSlippage(n);
              }}
              placeholder="…"
              inputMode="decimal"
              className={`w-14 rounded-md border bg-transparent px-1.5 py-0.5 pr-4 text-right font-mono font-bold outline-none transition focus:border-stbl-yolk dark:text-stbl-shell ${
                customSlippage !== ""
                  ? "border-stbl-yolk bg-stbl-yolk/10"
                  : "border-stbl-straw/40 dark:border-stbl-700"
              }`}
            />
            <span className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 text-stbl-shell/40">
              %
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={submit}
          disabled={busy}
          className={`mt-4 w-full rounded-xl px-4 py-3 text-sm font-extrabold shadow-md transition disabled:opacity-50 ${
            tab === "buy"
              ? "bg-emerald-600 text-white hover:bg-emerald-500"
              : "bg-red-500 text-white hover:bg-red-400"
          }`}
        >
          {label}
        </button>

        {writeError ? (
          <p className="mt-2 break-words text-[11px] leading-snug text-red-500">
            {writeError.message.split("\n")[0].slice(0, 160)}
          </p>
        ) : null}
        <p className="mt-2 text-center text-[10px] text-stbl-shell/40">
          Real uniswap v3 pool, locked forever · 1% fee grows the coin ·
          anti-snipe: 2% max buy per wallet in the first 2 minutes
        </p>
      </div>
    </div>
  );
}
