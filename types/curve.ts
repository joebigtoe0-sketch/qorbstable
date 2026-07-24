export type CurveTokenJson = {
  address: string;
  creator: string;
  /** standard = clean coin; lpGrow = pool fees reinvest into locked LP;
   * superLp = 5% buy tax swap-and-liquified into locked LP (hidden in the
   * launch UI for now). */
  flavor: "standard" | "lpGrow" | "superLp";
  name: string;
  symbol: string;
  metadataUri: string;
  description: string;
  imageUrl: string;
  website: string;
  twitter: string;
  telegram: string;
  /** trading = climbing the bonding curve; graduated = cosmetic badge —
   * the pool trades on Uniswap v3 from block one either way. */
  phase: "trading" | "graduated";
  /** The token's Uniswap v3 pool address. */
  pair: string;
  priceUsd: number;
  marketCapUsd: number;
  progress: number;
  raisedUsd: number;
  tradeCount: number;
  volumeUsd: number;
  change24h: number;
  createdAt: string;
  graduatedAt: string | null;
  lastTradeAt: string | null;
  holderCount?: number;
};

export type CurveTradeJson = {
  txHash: string;
  logIndex: number;
  token: string;
  trader: string;
  isBuy: boolean;
  /** USD value in 6-decimal USDT0 units. */
  usdWei: string;
  tokenAmount: string;
  priceUsd: number;
  ts: string;
  tokenSymbol?: string;
  tokenName?: string;
  imageUrl?: string;
};

export type CurveCandleJson = {
  time: number; // unix seconds, bucket start
  open: number;
  high: number;
  low: number;
  close: number;
  volumeUsd: number;
};

export type CurveHolderJson = {
  holder: string;
  balance: string;
  pct: number;
  tag?: "creator" | "pair" | "burn" | "curve";
};

export type AnalyticsBucketJson = {
  day: string; // YYYY-MM-DD
  volumeUsd: number;
  launches: number;
  trades: number;
};

export type AnalyticsJson = {
  period: "24h" | "7d" | "30d" | "all";
  launches: number;
  launchesAllTime: number;
  volumeUsd: number;
  trades: number;
  buys: number;
  sells: number;
  protocolRevenueUsd: number;
  creatorRevenueUsd: number;
  graduatedAllTime: number;
  buckets: AnalyticsBucketJson[];
  topTokens: {
    address: string;
    name: string;
    symbol: string;
    imageUrl: string;
    volumeUsd: number;
    tradeCount: number;
    flavor: CurveTokenJson["flavor"];
  }[];
  updatedAt: string;
};
