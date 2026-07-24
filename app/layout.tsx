import type { Metadata } from "next";
import { IBM_Plex_Mono, Inter } from "next/font/google";

import { CurrencyProvider } from "@/components/curve/CurrencyProvider";
import { EvmProvider } from "@/components/EvmProvider";
import { StableShell } from "@/components/StableShell";

import "./globals.css";

// QORB brand: Inter everywhere with heavy display weights; IBM Plex Mono
// stays for tickers, prices, and addresses.
const fontSans = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-geist-sans",
});

const fontMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-geist-mono",
});

const fontDisplay = Inter({
  subsets: ["latin"],
  weight: ["700", "800", "900"],
  variable: "--font-stbl-display",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://qorb.fun"),
  title: "QORB — token launchpad on Stable Chain",
  description:
    "Launch a token straight into a permanently locked Uniswap v3 pool on Stable Chain. Free launches, USDT0-paired, liquidity locked forever. qorb.fun",
  openGraph: {
    title: "QORB — token launchpad on Stable Chain",
    description:
      "Launch a token straight into a permanently locked Uniswap v3 pool on Stable Chain. Free launches, USDT0-paired, liquidity locked forever.",
    url: "https://qorb.fun",
    siteName: "QORB",
    images: [{ url: "/logo.png" }],
  },
  icons: {
    icon: "/logo.png",
    apple: "/logo.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`dark ${fontSans.variable} ${fontMono.variable} ${fontDisplay.variable}`}
    >
      <body className="min-h-screen font-sans antialiased text-stbl-ink">
        <EvmProvider>
          <CurrencyProvider>
            <StableShell>{children}</StableShell>
          </CurrencyProvider>
        </EvmProvider>
      </body>
    </html>
  );
}
