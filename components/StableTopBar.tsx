"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";
import Image from "next/image";
import Link from "next/link";

import { CoinSearch } from "@/components/curve/CoinSearch";

export function StableTopBar({ onMenu }: { onMenu: () => void }) {
  return (
    <header className="sticky top-0 z-20 flex shrink-0 items-center gap-3 border-b border-stbl-straw/35 bg-stbl-surface/90 px-3 py-3 backdrop-blur-md dark:border-stbl-700 dark:bg-stbl-900/90 md:px-5">
      <button
        type="button"
        onClick={onMenu}
        className="rounded-lg p-2 text-stbl-ink hover:bg-stbl-surface-warm dark:text-stbl-shell dark:hover:bg-stbl-800 md:hidden"
        aria-label="Open menu"
      >
        <svg
          className="h-5 w-5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          aria-hidden
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M4 6h16M4 12h16M4 18h16"
          />
        </svg>
      </button>

      <Link
        href="/"
        className="flex items-center gap-2 font-display text-lg font-black md:hidden"
      >
        <Image src="/logo.png" alt="" width={28} height={28} className="rounded-full" />
        <span className="bg-gradient-to-r from-stbl-yolk via-stbl-orange to-stbl-yolk bg-clip-text uppercase tracking-[0.2em] text-transparent">
          qorb
        </span>
      </Link>

      <div className="flex flex-1 justify-center px-2">
        <CoinSearch />
      </div>

      <div className="ml-auto flex items-center gap-2 lowercase">
        <Link
          href="/launch"
          className="hidden items-center gap-1.5 rounded-xl border border-stbl-yolk/50 px-4 py-2 text-sm font-bold lowercase text-stbl-yolk transition hover:bg-stbl-yolk hover:text-stbl-950 sm:inline-flex"
        >
          launch a coin
        </Link>
        <ConnectButton
          label="connect wallet"
          showBalance={false}
          chainStatus="icon"
          accountStatus={{ smallScreen: "avatar", largeScreen: "full" }}
        />
      </div>
    </header>
  );
}
