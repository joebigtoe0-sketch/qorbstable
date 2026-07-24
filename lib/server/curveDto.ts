import { GRADUATION_USD } from "@/lib/evm/curveMath";
import type { CurveTokenJson, CurveTradeJson } from "@/types/curve";

/** v3 start price: tick -400600 ≈ $4.03e-6 per token. */
const START_PRICE = 4.03e-6;

const FLAVORS = ["standard", "lpGrow", "superLp"] as const;

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL?.trim() || "https://qorb.fun";

/**
 * Convert a curve_tokens row (pg or PGlite) into the API DTO. Legacy column
 * names: `last_price` is USD per whole token (already decimal-normalized by
 * the indexer); `raised_wei` / `volume_wei` / `eth_wei` are 6-decimal USDT0
 * amounts.
 */
export function tokenRowToJson(row: Record<string, unknown>): CurveTokenJson {
  const price = Number(row.last_price ?? 0) || START_PRICE;
  const graduated = Number(row.phase) === 2;
  const raisedUsd = Number(String(row.raised_wei ?? "0")) / 1e6;
  const basePrice = row.base_price != null ? Number(row.base_price) : START_PRICE;
  const change24h = basePrice > 0 && Number(row.trade_count ?? 0) > 0 ? price / basePrice - 1 : 0;
  // Tokens without a creator-supplied website get their Stable page as the
  // canonical link — every token always has a home.
  const rawWebsite = String(row.website ?? "");
  const website =
    !rawWebsite || rawWebsite.startsWith(`${SITE_URL}/l/`)
      ? `${SITE_URL}/coin/${String(row.address)}`
      : rawWebsite;

  return {
    address: String(row.address),
    creator: String(row.creator),
    flavor: FLAVORS[Number(row.flavor)] ?? "standard",
    name: String(row.name),
    symbol: String(row.symbol),
    metadataUri: String(row.metadata_uri ?? ""),
    description: String(row.description ?? ""),
    imageUrl: String(row.image_url ?? ""),
    website,
    twitter: String(row.twitter ?? ""),
    telegram: String(row.telegram ?? ""),
    phase: graduated ? "graduated" : "trading",
    pair: String(row.pool ?? ""),
    priceUsd: price,
    marketCapUsd: price * 1e9,
    progress: graduated ? 1 : Math.min(1, raisedUsd / GRADUATION_USD),
    raisedUsd,
    tradeCount: Number(row.trade_count ?? 0),
    volumeUsd: Number(String(row.volume_wei ?? "0")) / 1e6,
    change24h,
    createdAt: new Date(String(row.created_at)).toISOString(),
    graduatedAt: row.graduated_at
      ? new Date(String(row.graduated_at)).toISOString()
      : null,
    lastTradeAt: row.last_trade_at
      ? new Date(String(row.last_trade_at)).toISOString()
      : null,
    ...(row.holder_count !== undefined
      ? { holderCount: Number(row.holder_count) }
      : {}),
  };
}

export function tradeRowToJson(row: Record<string, unknown>): CurveTradeJson {
  return {
    txHash: String(row.tx_hash),
    logIndex: Number(row.log_index),
    token: String(row.token),
    trader: String(row.trader),
    isBuy: Boolean(row.is_buy),
    usdWei: String(row.eth_wei),
    tokenAmount: String(row.token_amount),
    priceUsd: Number(row.price),
    ts: new Date(String(row.ts)).toISOString(),
    ...(row.symbol !== undefined ? { tokenSymbol: String(row.symbol) } : {}),
    ...(row.name !== undefined ? { tokenName: String(row.name) } : {}),
    ...(row.image_url !== undefined ? { imageUrl: String(row.image_url) } : {}),
  };
}
