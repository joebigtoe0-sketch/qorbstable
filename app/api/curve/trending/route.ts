import { NextResponse } from "next/server";

import { curveDb } from "@/lib/server/curveDb";
import { tokenRowToJson } from "@/lib/server/curveDto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Trending bar: coins ranked by volume in the last 5 minutes; a quiet
 * 5-minute window silently widens to 24h so the bar doesn't vanish between
 * bursts of activity. Only a fully dead board returns empty (bar hides). */
export async function GET() {
  try {
    const db = await curveDb();

    const query = (interval: string) =>
      db.query(
        `SELECT t.*, v.vol AS window_vol
         FROM curve_tokens t
         JOIN (
           SELECT token, SUM(eth_wei) AS vol
           FROM curve_trades
           WHERE ts > now() - interval '${interval}' AND NOT internal
           GROUP BY token
         ) v ON v.token = t.address
         ORDER BY v.vol DESC
         LIMIT 8`
      );

    let rows = (await query("5 minutes")).rows;
    let window: "5m" | "24h" = "5m";
    if (rows.length === 0) {
      rows = (await query("24 hours")).rows;
      window = "24h";
    }

    return NextResponse.json({
      window,
      tokens: rows.map((r) => ({
        ...tokenRowToJson(r),
        windowVolumeUsd: Number(String(r.window_vol ?? "0")) / 1e6,
      })),
    });
  } catch (err) {
    console.error("[api/curve/trending]", err);
    return NextResponse.json({ window: "5m", tokens: [] }, { status: 200 });
  }
}
