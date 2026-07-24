"use client";

import "@rainbow-me/rainbowkit/styles.css";

import { darkTheme, RainbowKitProvider } from "@rainbow-me/rainbowkit";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { WagmiProvider } from "wagmi";

import { wagmiConfig } from "@/lib/evm/wagmiConfig";

// QORB: teal accent on navy, matching qorb.fun.
const theme = darkTheme({
  accentColor: "#20b2aa",
  accentColorForeground: "#0a0f1e",
  borderRadius: "large",
});
theme.colors.modalBackground = "#121a30";
theme.colors.connectButtonBackground = "#1a2440";

export function EvmProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider modalSize="compact" theme={theme}>
          {children}
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
