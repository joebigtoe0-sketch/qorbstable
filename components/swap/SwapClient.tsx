"use client";

import { useConnectModal } from "@rainbow-me/rainbowkit";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  formatEther,
  formatUnits,
  isAddress,
  maxUint256,
  parseAbi,
  parseEther,
  parseUnits,
} from "viem";
import {
  useAccount,
  useChainId,
  usePublicClient,
  useReadContract,
  useSwitchChain,
  useWaitForTransactionReceipt,
  useWriteContract,
} from "wagmi";

import { CoinIcon } from "@/components/icons";
import { erc20Abi } from "@/lib/evm/abi/erc20";
import { stableLaunchTokenAbi } from "@/lib/evm/abi/stableLaunchToken";
import { stableRouterAbi } from "@/lib/evm/abi/stableRouter";
import { uniswapV3PoolAbi } from "@/lib/evm/abi/uniswapV3Pool";
import {
  activeChain,
  isEvmConfigured,
  routerAddress,
  usdt0Address,
} from "@/lib/evm/chains";
import { POOL_FEE_TIER, quotePoolSwap } from "@/lib/evm/curveMath";
import { ipfsToHttp } from "@/lib/evm/ipfs";
import type { CurveTokenJson } from "@/types/curve";

const SLIPPAGE_PRESETS = [0.5, 1, 2, 5];
const ZERO_ADDR = "0x0000000000000000000000000000000000000000" as const;

const factoryAbi = parseAbi([
  "function getPool(address tokenA, address tokenB, uint24 fee) view returns (address)",
]);

type TokenChoice = {
  id: string; // lowercase address
  address: `0x${string}`;
  symbol: string;
  name: string;
  imageUrl?: string;
  pool?: `0x${string}`;
};

function TokenButton({
  token,
  onClick,
}: {
  token: TokenChoice | null;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className="flex shrink-0 items-center gap-2 rounded-xl border border-stbl-straw/40 bg-stbl-surface-warm/60 px-3 py-2 text-sm font-bold text-stbl-shell transition enabled:hover:border-stbl-yolk dark:border-stbl-700 dark:bg-stbl-800/60"
    >
      {token?.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={ipfsToHttp(token.imageUrl)} alt="" className="h-5 w-5 rounded-full object-cover" />
      ) : (
        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-stbl-yolk/25 text-[9px] font-extrabold text-stbl-yolk">
          {(token?.symbol ?? "?").slice(0, 2)}
        </span>
      )}
      {token?.symbol ?? "select"}
      {onClick ? <span className="text-stbl-shell/40">▾</span> : null}
    </button>
  );
}

function TokenPicker({
  open,
  tokens,
  onPick,
  onClose,
  onCustom,
}: {
  open: boolean;
  tokens: TokenChoice[];
  onPick: (t: TokenChoice) => void;
  onClose: () => void;
  onCustom: (addr: string) => void;
}) {
  const [query, setQuery] = useState("");
  if (!open) return null;

  const q = query.trim().toLowerCase();
  const list = tokens.filter(
    (t) =>
      !q ||
      t.symbol.toLowerCase().includes(q) ||
      t.name.toLowerCase().includes(q) ||
      t.id.includes(q)
  );

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 p-4 pt-24" onClick={onClose}>
      <div
        className="w-full max-w-sm rounded-2xl border border-stbl-700 bg-stbl-900 p-4 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="mb-2 font-display text-sm font-extrabold text-stbl-shell">select a coin</p>
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="search name, ticker, or paste 0x address…"
          className="w-full rounded-xl border border-stbl-700 bg-stbl-950 px-3 py-2 text-sm text-stbl-shell outline-none focus:border-stbl-yolk"
        />
        {isAddress(q) ? (
          <button
            type="button"
            onClick={() => {
              onCustom(q);
              setQuery("");
            }}
            className="mt-2 w-full rounded-xl border border-dashed border-stbl-yolk/50 px-3 py-2 text-left text-xs font-bold text-stbl-yolk hover:bg-stbl-yolk/10"
          >
            use custom token {q.slice(0, 8)}…{q.slice(-4)}
          </button>
        ) : null}
        <div className="mt-2 max-h-72 space-y-1 overflow-y-auto">
          {list.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => {
                onPick(t);
                setQuery("");
              }}
              className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left transition hover:bg-stbl-800"
            >
              {t.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={ipfsToHttp(t.imageUrl)} alt="" className="h-7 w-7 rounded-full object-cover" />
              ) : (
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-stbl-yolk/25 text-[10px] font-extrabold text-stbl-yolk">
                  {t.symbol.slice(0, 2)}
                </span>
              )}
              <span className="min-w-0">
                <span className="block text-sm font-bold text-stbl-shell">{t.symbol}</span>
                <span className="block truncate text-[11px] text-stbl-shell/50">{t.name}</span>
              </span>
            </button>
          ))}
          {list.length === 0 ? (
            <p className="px-2 py-6 text-center text-xs text-stbl-shell/50">
              no matches — paste a token address to add it.
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

/**
 * Every launched coin trades on a Uniswap v3 pool against USDT0, so the swap
 * page is a single-hop USDT0 <-> coin panel over our router: side "buy" pays
 * USDT0 (6 decimals) for coins, "sell" does the reverse. Quotes come from the
 * pool's slot0/liquidity, computed client-side (buys are approve-gated
 * transferFrom pulls, which breaks eth_call simulation quotes).
 */
export function SwapClient() {
  const configured = isEvmConfigured();
  if (!configured) {
    return (
      <div className="mx-auto max-w-md rounded-2xl border border-dashed border-stbl-straw/50 bg-stbl-surface-warm/30 px-6 py-16 text-center dark:border-stbl-700 dark:bg-stbl-800/30">
        <CoinIcon className="mx-auto h-10 w-10 text-stbl-shell/30" />
        <p className="mt-3 font-display text-lg font-extrabold lowercase text-stbl-shell">
          swaps aren&apos;t configured on this chain yet
        </p>
        <p className="mt-1 text-sm lowercase text-stbl-shell/60">
          set the launchpad + router addresses to enable trading.
        </p>
      </div>
    );
  }
  return <SwapPanel />;
}

function SwapPanel() {
  const { address: account, isConnected } = useAccount();
  const { openConnectModal } = useConnectModal();
  const chainId = useChainId();
  const { switchChain } = useSwitchChain();
  const client = usePublicClient();
  const params = useSearchParams();

  const chain = activeChain();
  const router = routerAddress();
  const usdt0 = usdt0Address();

  const usdtChoice: TokenChoice = useMemo(
    () => ({ id: usdt0.toLowerCase(), address: usdt0, symbol: "USDT0", name: "USDT0" }),
    [usdt0]
  );

  const [tokens, setTokens] = useState<TokenChoice[]>([]);
  const [tok, setTok] = useState<TokenChoice | null>(null);
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [amount, setAmount] = useState("");
  const [picker, setPicker] = useState(false);
  const [slippagePct, setSlippagePct] = useState(2);
  const [customSlippage, setCustomSlippage] = useState("");

  // Every launched coin has a live pool from block one.
  useEffect(() => {
    let stop = false;
    const load = async () => {
      try {
        const res = await fetch("/api/curve/tokens?sort=volume&limit=200", {
          cache: "no-store",
        });
        const data = (await res.json()) as { tokens?: CurveTokenJson[] };
        if (stop) return;
        setTokens(
          (data.tokens ?? []).map(
            (t): TokenChoice => ({
              id: t.address.toLowerCase(),
              address: t.address as `0x${string}`,
              symbol: t.symbol,
              name: t.name,
              imageUrl: t.imageUrl,
              pool: (t.pair || undefined) as `0x${string}` | undefined,
            })
          )
        );
      } catch {
        /* keep last */
      }
    };
    void load();
    const id = setInterval(() => void load(), 30_000);
    return () => {
      stop = true;
      clearInterval(id);
    };
  }, []);

  const addCustomToken = useCallback(
    async (addr: string) => {
      const address = addr.toLowerCase() as `0x${string}`;
      let symbol = `${addr.slice(0, 6)}…`;
      let name = addr;
      let pool: `0x${string}` | undefined;
      try {
        if (client) {
          symbol = (await client.readContract({
            address,
            abi: stableLaunchTokenAbi,
            functionName: "symbol",
          })) as string;
          name = (await client.readContract({
            address,
            abi: stableLaunchTokenAbi,
            functionName: "name",
          })) as string;
          const factory = (await client.readContract({
            address: router,
            abi: stableRouterAbi,
            functionName: "uniswapFactory",
          })) as `0x${string}`;
          const p = (await client.readContract({
            address: factory,
            abi: factoryAbi,
            functionName: "getPool",
            args: [address, usdt0, POOL_FEE_TIER],
          })) as `0x${string}`;
          if (p && p !== ZERO_ADDR) pool = p;
        }
      } catch {
        /* not an ERC20 with metadata — keep address labels */
      }
      const t: TokenChoice = { id: address, address, symbol, name, pool };
      setTokens((prev) => (prev.some((p) => p.id === t.id) ? prev : [...prev, t]));
      return t;
    },
    [client, router, usdt0]
  );

  // ?to= / ?from= preselection (coin pages link here).
  useEffect(() => {
    const to = params.get("to")?.toLowerCase();
    const from = params.get("from")?.toLowerCase();
    const wanted = to && to !== usdt0.toLowerCase() ? to : from;
    if (!wanted || !isAddress(wanted)) return;
    if (wanted === usdt0.toLowerCase()) return;
    if (from && from !== usdt0.toLowerCase()) setSide("sell");
    const apply = async () => {
      const known = tokens.find((t) => t.id === wanted);
      setTok(known ?? (await addCustomToken(wanted)));
    };
    void apply();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params, tokens.length]);

  const wrongChain = isConnected && chainId !== chain.id;
  const tokenIs0 = Boolean(tok && tok.id < usdt0.toLowerCase());

  // Buys spend 6-decimal USDT0; sells spend the 18-decimal coin.
  const amountIn = useMemo(() => {
    const n = Number(amount);
    if (!Number.isFinite(n) || n <= 0) return 0n;
    try {
      return side === "buy" ? parseUnits(n.toFixed(6), 6) : parseEther(n.toFixed(18));
    } catch {
      return 0n;
    }
  }, [amount, side]);

  const { data: slot0 } = useReadContract({
    abi: uniswapV3PoolAbi,
    address: tok?.pool,
    functionName: "slot0",
    query: { enabled: Boolean(tok?.pool), refetchInterval: 5_000 },
  });
  const { data: liquidity } = useReadContract({
    abi: uniswapV3PoolAbi,
    address: tok?.pool,
    functionName: "liquidity",
    query: { enabled: Boolean(tok?.pool), refetchInterval: 5_000 },
  });

  const quotedOut = useMemo(() => {
    if (!slot0 || liquidity === undefined || !tok) return 0;
    const inHuman = side === "buy" ? Number(amountIn) / 1e6 : Number(amountIn) / 1e18;
    if (!(inHuman > 0)) return 0;
    return quotePoolSwap({
      sqrtPriceX96: slot0[0],
      liquidity,
      tokenIs0,
      direction: side,
      amountIn: inHuman,
    });
  }, [slot0, liquidity, tok, side, amountIn, tokenIs0]);

  // Spot price (USD per whole coin) for the impact estimate.
  const spotPrice = useMemo(() => {
    if (!slot0) return 0;
    const ratio = Number(slot0[0]) / 2 ** 96;
    const p = ratio * ratio;
    return tokenIs0 ? p * 1e12 : p === 0 ? 0 : (1 / p) * 1e12;
  }, [slot0, tokenIs0]);

  const priceImpactPct = useMemo(() => {
    if (!(quotedOut > 0) || !(spotPrice > 0) || amountIn === 0n) return null;
    const inHuman = side === "buy" ? Number(amountIn) / 1e6 : Number(amountIn) / 1e18;
    const spotOut =
      side === "buy" ? (inHuman * 0.99) / spotPrice : inHuman * 0.99 * spotPrice;
    if (!(spotOut > 0)) return null;
    return Math.max(0, (1 - quotedOut / spotOut) * 100);
  }, [quotedOut, spotPrice, amountIn, side]);

  // Balances + allowance for the input side.
  const { data: usdBal, refetch: refetchUsdBal } = useReadContract({
    abi: erc20Abi,
    address: usdt0,
    functionName: "balanceOf",
    args: [account ?? ZERO_ADDR],
    query: { enabled: Boolean(account) },
  });
  const { data: tokBal, refetch: refetchTokBal } = useReadContract({
    abi: stableLaunchTokenAbi,
    address: tok?.address,
    functionName: "balanceOf",
    args: [account ?? ZERO_ADDR],
    query: { enabled: Boolean(account && tok) },
  });

  const { data: allowance, refetch: refetchAllowance } = useReadContract({
    abi: erc20Abi,
    address: side === "buy" ? usdt0 : tok?.address,
    functionName: "allowance",
    args: [account ?? ZERO_ADDR, router],
    query: { enabled: Boolean(account && (side === "buy" || tok)) },
  });
  const needsApproval = amountIn > 0n && (allowance ?? 0n) < amountIn;

  const { writeContract, data: txHash, isPending, error: writeError, reset } =
    useWriteContract();
  const { isLoading: confirming, isSuccess: confirmed } =
    useWaitForTransactionReceipt({ hash: txHash });

  useEffect(() => {
    if (confirmed) {
      reset();
      void refetchAllowance();
      void refetchUsdBal();
      void refetchTokBal();
      if (!needsApproval) setAmount("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [confirmed]);

  const setSlippage = (pct: number) => {
    if (!(pct > 0) || pct > 50) return;
    setSlippagePct(pct);
  };

  const minOut = useMemo(() => {
    if (!(quotedOut > 0)) return 0n;
    const raw =
      side === "buy"
        ? parseEther(quotedOut.toFixed(18))
        : parseUnits(quotedOut.toFixed(6), 6);
    const bps = BigInt(Math.round(slippagePct * 100));
    return (raw * (10_000n - bps)) / 10_000n;
  }, [quotedOut, side, slippagePct]);

  const flip = () => {
    setSide((s) => (s === "buy" ? "sell" : "buy"));
    setAmount("");
  };

  const submit = () => {
    if (!isConnected) {
      openConnectModal?.();
      return;
    }
    if (wrongChain) {
      switchChain({ chainId: chain.id });
      return;
    }
    if (!tok || amountIn === 0n || !(quotedOut > 0)) return;

    if (needsApproval) {
      writeContract({
        abi: erc20Abi,
        address: side === "buy" ? usdt0 : tok.address,
        functionName: "approve",
        args: [router, maxUint256],
      });
      return;
    }

    if (side === "buy") {
      writeContract({
        abi: stableRouterAbi,
        address: router,
        functionName: "buyExactUsd",
        args: [tok.address, POOL_FEE_TIER, amountIn, minOut, account!],
      });
    } else {
      writeContract({
        abi: stableRouterAbi,
        address: router,
        functionName: "sellExactTokens",
        args: [tok.address, POOL_FEE_TIER, amountIn, minOut, account!],
      });
    }
  };

  const busy = isPending || confirming;
  const fromBalance = side === "buy" ? usdBal ?? 0n : tokBal ?? 0n;
  const fromBalanceHuman =
    side === "buy" ? Number(formatUnits(fromBalance, 6)) : Number(formatEther(fromBalance));
  const inHuman = side === "buy" ? Number(amountIn) / 1e6 : Number(amountIn) / 1e18;
  const rate = quotedOut > 0 && inHuman > 0 ? quotedOut / inHuman : null;
  const fromSymbol = side === "buy" ? "USDT0" : tok?.symbol ?? "";
  const toSymbol = side === "buy" ? tok?.symbol ?? "" : "USDT0";

  const label = !isConnected
    ? "connect wallet"
    : wrongChain
      ? `switch to ${chain.name}`
      : busy
        ? "confirming…"
        : !tok
          ? "select a coin"
          : !tok.pool
            ? "no pool for this coin"
            : amountIn === 0n
              ? "enter an amount"
              : !(quotedOut > 0)
                ? "no liquidity"
                : needsApproval
                  ? `approve ${fromSymbol}`
                  : "swap";

  return (
    <div className="mx-auto max-w-md">
      <div className="rounded-3xl border border-stbl-straw/40 bg-stbl-surface p-4 shadow-lg dark:border-stbl-700 dark:bg-stbl-900/70">
        <div className="mb-3 flex items-center justify-between">
          <h1 className="font-display text-lg font-extrabold text-stbl-shell">swap</h1>
          <span className="rounded-full bg-stbl-yolk/15 px-2 py-0.5 text-[10px] font-bold text-stbl-yolk">
            uniswap v3 · 1% pool fee
          </span>
        </div>

        {/* from */}
        <div className="rounded-2xl border border-stbl-straw/40 bg-stbl-canvas p-3 dark:border-stbl-700 dark:bg-stbl-950">
          <div className="flex items-center justify-between text-[11px] text-stbl-shell/50">
            <span>you pay</span>
            {account && (side === "buy" || tok) ? (
              <button
                type="button"
                className="font-mono underline decoration-dotted"
                onClick={() =>
                  setAmount(
                    side === "buy" ? formatUnits(fromBalance, 6) : formatEther(fromBalance)
                  )
                }
              >
                balance {fromBalanceHuman.toLocaleString("en-US", { maximumFractionDigits: 2 })}
              </button>
            ) : null}
          </div>
          <div className="mt-1 flex items-center gap-2">
            <input
              value={amount}
              onChange={(e) => setAmount(e.target.value.replace(",", "."))}
              inputMode="decimal"
              placeholder="0.0"
              className="w-full bg-transparent font-mono text-2xl font-semibold text-stbl-shell outline-none"
            />
            {side === "buy" ? (
              <TokenButton token={usdtChoice} />
            ) : (
              <TokenButton token={tok} onClick={() => setPicker(true)} />
            )}
          </div>
        </div>

        {/* flip */}
        <div className="relative z-[1] -my-2.5 flex justify-center">
          <button
            type="button"
            onClick={flip}
            aria-label="Flip direction"
            className="rounded-xl border border-stbl-700 bg-stbl-800 p-1.5 text-stbl-yolk transition hover:rotate-180 hover:border-stbl-yolk"
          >
            <svg className="h-4 w-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden>
              <path d="M5 2.5v11M5 13.5 2.5 11M5 13.5 7.5 11M11 13.5v-11M11 2.5 8.5 5M11 2.5 13.5 5" />
            </svg>
          </button>
        </div>

        {/* to */}
        <div className="rounded-2xl border border-stbl-straw/40 bg-stbl-canvas p-3 dark:border-stbl-700 dark:bg-stbl-950">
          <p className="text-[11px] text-stbl-shell/50">you receive (estimated)</p>
          <div className="mt-1 flex items-center gap-2">
            <p className="w-full truncate font-mono text-2xl font-semibold text-stbl-shell">
              {quotedOut > 0
                ? quotedOut.toLocaleString("en-US", { maximumFractionDigits: 4 })
                : "0.0"}
            </p>
            {side === "buy" ? (
              <TokenButton token={tok} onClick={() => setPicker(true)} />
            ) : (
              <TokenButton token={usdtChoice} />
            )}
          </div>
        </div>

        {/* details */}
        {tok && amountIn > 0n && quotedOut > 0 ? (
          <div className="mt-3 space-y-1 rounded-xl bg-stbl-surface-warm/50 px-3 py-2 text-[11px] text-stbl-shell/60 dark:bg-stbl-800/50">
            <div className="flex justify-between">
              <span>rate</span>
              <span className="font-mono">
                1 {fromSymbol} ≈ {rate ? rate.toLocaleString("en-US", { maximumFractionDigits: 6 }) : "—"} {toSymbol}
              </span>
            </div>
            <div className="flex justify-between">
              <span>min received ({slippagePct}% slippage)</span>
              <span className="font-mono">
                {(side === "buy"
                  ? Number(formatEther(minOut))
                  : Number(formatUnits(minOut, 6))
                ).toLocaleString("en-US", { maximumFractionDigits: 4 })}
              </span>
            </div>
            <div className="flex justify-between">
              <span>price impact</span>
              <span
                className={`font-mono ${
                  priceImpactPct != null && priceImpactPct > 5 ? "text-red-400" : ""
                }`}
              >
                {priceImpactPct != null ? `${priceImpactPct.toFixed(2)}%` : "—"}
              </span>
            </div>
            <div className="flex justify-between">
              <span>route</span>
              <span className="font-mono">
                {fromSymbol} → {toSymbol}
              </span>
            </div>
          </div>
        ) : null}

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
              className={`w-14 rounded-md border bg-transparent px-1.5 py-0.5 pr-4 text-right font-mono font-bold text-stbl-shell outline-none transition focus:border-stbl-yolk ${
                customSlippage !== "" ? "border-stbl-yolk bg-stbl-yolk/10" : "border-stbl-straw/40 dark:border-stbl-700"
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
          disabled={busy || (isConnected && !wrongChain && (!tok || amountIn === 0n || !(quotedOut > 0)))}
          className="mt-4 w-full rounded-xl bg-stbl-yolk px-4 py-3 text-sm font-extrabold text-stbl-950 shadow-md transition hover:brightness-110 disabled:opacity-50"
        >
          {label}
        </button>

        {writeError ? (
          <p className="mt-2 break-words text-[11px] leading-snug text-red-500">
            {writeError.message.split("\n")[0].slice(0, 160)}
          </p>
        ) : null}
        <p className="mt-2 flex items-center justify-center gap-1.5 text-center text-[10px] text-stbl-shell/40">
          <CoinIcon className="h-3 w-3" />
          Every coin trades on a real uniswap v3 pool — liquidity locked
          forever, 1% fee grows the coin.
        </p>
      </div>

      <TokenPicker
        open={picker}
        tokens={tokens}
        onClose={() => setPicker(false)}
        onPick={(t) => {
          setTok(t);
          setPicker(false);
        }}
        onCustom={(addr) => {
          void addCustomToken(addr).then((t) => setTok(t));
          setPicker(false);
        }}
      />
    </div>
  );
}
