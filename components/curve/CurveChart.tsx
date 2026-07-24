"use client";

import {
  CandlestickSeries,
  ColorType,
  createChart,
  HistogramSeries,
  type IChartApi,
  type ISeriesApi,
  type MouseEventParams,
  type UTCTimestamp,
} from "lightweight-charts";
import { useEffect, useRef, useState } from "react";

import { useCurrency } from "@/components/curve/CurrencyProvider";
import type { CurveCandleJson } from "@/types/curve";

const RESOLUTIONS = [
  { key: 1, label: "1s" },
  { key: 15, label: "15s" },
  { key: 30, label: "30s" },
  { key: 60, label: "1m" },
  { key: 300, label: "5m" },
  { key: 900, label: "15m" },
  { key: 3600, label: "1h" },
  { key: 14400, label: "4h" },
  { key: 86400, label: "1d" },
];

const SUBSCRIPTS = "₀₁₂₃₄₅₆₇₈₉";

/** Axis/legend price formatter that survives 1e-9-scale token prices: large
 * values get K/M suffixes, tiny ones the crypto-standard 0.0₈1165 notation. */
function fmtPriceValue(v: number): string {
  if (!Number.isFinite(v) || v <= 0) return "0";
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(2)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(2)}K`;
  if (v >= 1) return v.toFixed(2);
  if (v >= 0.01) return v.toFixed(4);
  const zeros = Math.ceil(-Math.log10(v)) - 1;
  const digits = Math.floor(v * 10 ** (zeros + 4))
    .toString()
    .padStart(4, "0");
  const sub = String(zeros)
    .split("")
    .map((c) => SUBSCRIPTS[Number(c)])
    .join("");
  return `0.0${sub}${digits}`;
}

type Legend = {
  open: number;
  high: number;
  low: number;
  close: number;
  changePct: number;
  volumeUsd: number;
} | null;

/** Candles chart with volume pane, OHLC crosshair legend, timeframes, and a
 * market-cap / per-token-price toggle. Mcap (price × 1e9) is the default —
 * far more readable than 1e-9-scale prices. */
export function CurveChart({ address }: { address: string }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const volumeRef = useRef<ISeriesApi<"Histogram"> | null>(null);
  const candlesRef = useRef<CurveCandleJson[]>([]);
  const [res, setRes] = useState(300);
  const [mode, setMode] = useState<"mcap" | "price">("mcap");
  const [empty, setEmpty] = useState(false);
  const [legend, setLegend] = useState<Legend>(null);
  const { currency, ethUsd } = useCurrency();
  const usd = currency === "USD" && ethUsd > 0;
  const scale = (usd ? ethUsd : 1) * (mode === "mcap" ? 1e9 : 1);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const chart = createChart(el, {
      height: 360,
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: "#94a3b8",
        attributionLogo: false,
      },
      localization: { priceFormatter: fmtPriceValue },
      grid: {
        vertLines: { color: "rgba(148,163,184,0.08)" },
        horzLines: { color: "rgba(148,163,184,0.08)" },
      },
      timeScale: { timeVisible: true, secondsVisible: false, borderVisible: false },
      rightPriceScale: { borderVisible: false },
      autoSize: true,
    });
    const series = chart.addSeries(CandlestickSeries, {
      upColor: "#10b981",
      downColor: "#ef4444",
      wickUpColor: "#10b981",
      wickDownColor: "#ef4444",
      borderVisible: false,
      // Tiny minMove keeps 1e-9-scale prices from collapsing onto one axis
      // label; display formatting is handled by the custom priceFormatter.
      priceFormat: { type: "price", precision: 12, minMove: 1e-12 },
    });
    // Volume pane pinned to the bottom fifth of the chart.
    const volume = chart.addSeries(HistogramSeries, {
      priceScaleId: "volume",
      priceFormat: { type: "volume" },
      priceLineVisible: false,
      lastValueVisible: false,
    });
    chart.priceScale("volume").applyOptions({
      scaleMargins: { top: 0.8, bottom: 0 },
      borderVisible: false,
    });

    const onCrosshair = (param: MouseEventParams) => {
      if (!param.time || !param.seriesData.has(series)) {
        setLegend(null);
        return;
      }
      const c = candlesRef.current.find((k) => k.time === (param.time as number));
      if (!c) {
        setLegend(null);
        return;
      }
      setLegend({
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
        changePct: c.open > 0 ? (c.close / c.open - 1) * 100 : 0,
        volumeUsd: c.volumeUsd,
      });
    };
    chart.subscribeCrosshairMove(onCrosshair);

    chartRef.current = chart;
    seriesRef.current = series;
    volumeRef.current = volume;

    return () => {
      chart.unsubscribeCrosshairMove(onCrosshair);
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
      volumeRef.current = null;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const r = await fetch(`/api/curve/tokens/${address}/candles?res=${res}`, {
          cache: "no-store",
        });
        const data = (await r.json()) as { candles?: CurveCandleJson[] };
        if (cancelled || !seriesRef.current || !volumeRef.current) return;
        const candles = data.candles ?? [];
        candlesRef.current = candles;
        setEmpty(candles.length === 0);
        seriesRef.current.setData(
          candles.map((c) => ({
            time: c.time as UTCTimestamp,
            open: c.open * scale,
            high: c.high * scale,
            low: c.low * scale,
            close: c.close * scale,
          }))
        );
        volumeRef.current.setData(
          candles.map((c) => ({
            time: c.time as UTCTimestamp,
            value: c.volumeUsd * (usd ? ethUsd : 1),
            color:
              c.close >= c.open ? "rgba(16,185,129,0.4)" : "rgba(239,68,68,0.4)",
          }))
        );
      } catch {
        /* transient */
      }
    };

    chartRef.current?.timeScale().applyOptions({ secondsVisible: res < 60 });

    void load();
    const id = setInterval(() => void load(), res < 60 ? 2_000 : 5_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [address, res, scale, usd, ethUsd]);

  const fmtVal = (v: number) => fmtPriceValue(v * scale);

  return (
    <div className="rounded-2xl border border-stbl-straw/40 bg-stbl-surface p-4 dark:border-stbl-700 dark:bg-stbl-900/60">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <div className="flex rounded-lg border border-stbl-straw/40 p-0.5 dark:border-stbl-700">
          {(
            [
              { key: "mcap", label: "Mcap" },
              { key: "price", label: "Price" },
            ] as const
          ).map((m) => (
            <button
              key={m.key}
              type="button"
              onClick={() => setMode(m.key)}
              className={`rounded-md px-2 py-1 text-[11px] font-bold transition ${
                mode === m.key
                  ? "bg-stbl-yolk/30 text-stbl-ink dark:bg-stbl-yolk/20 dark:text-stbl-shell"
                  : "text-stbl-wood/60 hover:text-stbl-ink dark:text-stbl-shell/50"
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
        <p className="text-[11px] font-bold lowercase tracking-wider text-stbl-wood/60 dark:text-stbl-shell/50">
          {usd ? "USD" : "ETH"}
        </p>
        <div className="ml-auto flex rounded-lg border border-stbl-straw/40 p-0.5 dark:border-stbl-700">
          {RESOLUTIONS.map((r) => (
            <button
              key={r.key}
              type="button"
              onClick={() => setRes(r.key)}
              className={`rounded-md px-2 py-1 text-[11px] font-bold transition ${
                res === r.key
                  ? "bg-stbl-yolk/30 text-stbl-ink dark:bg-stbl-yolk/20 dark:text-stbl-shell"
                  : "text-stbl-wood/60 hover:text-stbl-ink dark:text-stbl-shell/50"
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>
      <div className="relative">
        <div ref={containerRef} className="h-[360px] w-full" />
        {legend ? (
          <div className="pointer-events-none absolute left-2 top-2 z-10 rounded-lg bg-stbl-surface/90 px-2.5 py-1.5 font-mono text-[11px] leading-snug text-stbl-wood shadow-sm backdrop-blur dark:bg-stbl-950/85 dark:text-stbl-shell/80">
            <span className="mr-2">O {fmtVal(legend.open)}</span>
            <span className="mr-2">H {fmtVal(legend.high)}</span>
            <span className="mr-2">L {fmtVal(legend.low)}</span>
            <span className="mr-2">C {fmtVal(legend.close)}</span>
            <span
              className={legend.changePct >= 0 ? "text-emerald-500" : "text-red-500"}
            >
              {legend.changePct >= 0 ? "+" : ""}
              {legend.changePct.toFixed(2)}%
            </span>
            <span className="ml-2 text-stbl-wood/60 dark:text-stbl-shell/50">
              vol {usd ? "$" : ""}
              {(legend.volumeUsd * (usd ? ethUsd : 1)).toLocaleString("en-US", {
                maximumFractionDigits: usd ? 0 : 4,
              })}
              {usd ? "" : " ETH"}
            </span>
          </div>
        ) : null}
        {empty ? (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-stbl-wood/60 dark:text-stbl-shell/50">
            No trades yet — the first trade paints the chart
          </div>
        ) : null}
      </div>
    </div>
  );
}
