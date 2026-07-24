"use client";

import { createContext, useContext } from "react";

/**
 * On Stable Chain the native gas token IS the dollar (USDT0), so there is no
 * price oracle and no display-currency toggle: every native amount is a USD
 * amount. The provider keeps the same context shape the fork's components
 * expect (`ethUsd` = native→USD rate, fixed at 1).
 */
export type DisplayCurrency = "USD";

type CurrencyContextValue = {
  currency: DisplayCurrency;
  /** Native (USDT0) → USD conversion rate. Always 1 on Stable Chain. */
  ethUsd: number;
  /** Format a native-denominated amount as dollars. */
  fmt: (amountUsd: number) => string;
};

function compactUsd(v: number): string {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(2)}M`;
  if (v >= 10_000) return `$${(v / 1_000).toFixed(1)}K`;
  if (v >= 1) return `$${v.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
  if (v > 0) return `$${v.toFixed(4)}`;
  return "$0";
}

const VALUE: CurrencyContextValue = {
  currency: "USD",
  ethUsd: 1,
  fmt: compactUsd,
};

const CurrencyContext = createContext<CurrencyContextValue>(VALUE);

export function CurrencyProvider({ children }: { children: React.ReactNode }) {
  return <CurrencyContext.Provider value={VALUE}>{children}</CurrencyContext.Provider>;
}

export function useCurrency(): CurrencyContextValue {
  return useContext(CurrencyContext);
}
