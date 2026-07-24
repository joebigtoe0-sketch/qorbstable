"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { XIcon } from "@/components/icons";
import type { ReactNode } from "react";

type NavItem = { href: string; label: string; icon: ReactNode; disabled?: boolean };

// Inline SVGs instead of unicode glyphs — glyph icons render at wildly
// different widths per device font and can wrap inside the w-5 box.
const ICON = "h-4 w-4";

const items: NavItem[] = [
  {
    href: "/",
    label: "the board",
    icon: (
      <svg className={ICON} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" aria-hidden>
        <path d="M8 1.8 14.2 8 8 14.2 1.8 8Z" />
      </svg>
    ),
  },
  {
    href: "/launch",
    label: "launch a coin",
    icon: (
      <svg className={ICON} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
        <circle cx="8" cy="8" r="6.2" />
        <circle cx="8" cy="8" r="2" fill="currentColor" stroke="none" />
      </svg>
    ),
  },
  {
    href: "/swap",
    label: "swap",
    icon: (
      <svg className={ICON} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M2.5 5.5h9M9 3l2.5 2.5L9 8" />
        <path d="M13.5 10.5h-9M7 13l-2.5-2.5L7 8" />
      </svg>
    ),
  },
  {
    href: "/portfolio",
    label: "portfolio",
    icon: (
      <svg className={ICON} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" aria-hidden>
        <rect x="2" y="2.5" width="12" height="11" rx="1.5" />
        <path d="M2 6.5h12M2 10.5h12" />
      </svg>
    ),
  },
  {
    href: "/analytics",
    label: "analytics",
    icon: (
      <svg className={ICON} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden>
        <path d="M3 13.5V10M8 13.5V6.5M13 13.5V3" />
      </svg>
    ),
  },
  {
    href: "/docs",
    label: "docs",
    icon: (
      <svg className={ICON} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" aria-hidden>
        <path d="M4 1.8h5.5L13 5.3v8.9H4Z" />
        <path d="M9.5 1.8v3.5H13" />
        <path d="M6.3 9h3.4M6.3 11.2h3.4" />
      </svg>
    ),
  },
];

export function StableSidebar({
  open,
  onNavigate,
}: {
  open: boolean;
  onNavigate: () => void;
}) {
  const pathname = usePathname();

  return (
    <aside
      className={`fixed inset-y-0 left-0 z-40 flex w-56 flex-col border-r border-stbl-straw/35 bg-stbl-surface/98 shadow-sm backdrop-blur-md transition-transform dark:border-stbl-700 dark:bg-stbl-900/98 md:static md:translate-x-0 ${
        open ? "translate-x-0" : "-translate-x-full md:translate-x-0"
      }`}
    >
      <div className="border-b border-stbl-straw/25 px-4 py-5 dark:border-stbl-700">
        <Link
          href="/"
          onClick={onNavigate}
          className="flex items-center gap-2.5 font-display text-xl font-black"
        >
          <Image
            src="/logo.png"
            alt="QORB"
            width={36}
            height={36}
            className="rounded-full drop-shadow-[0_4px_12px_rgba(32,178,170,0.35)]"
            priority
          />
          <span
            className="bg-gradient-to-r from-stbl-yolk via-stbl-orange to-stbl-yolk bg-clip-text uppercase tracking-[0.2em] text-transparent"
          >
            qorb
          </span>
        </Link>
        <p className="mt-1 text-[11px] lowercase leading-snug text-stbl-wood/65 dark:text-stbl-shell/55">
          better token launches
        </p>
      </div>
      <nav className="flex flex-1 flex-col gap-0.5 px-2 py-4">
        {items.map((item) => {
          const active = !item.disabled && pathname === item.href;
          const cls = `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
            item.disabled
              ? "cursor-not-allowed text-stbl-wood/35 dark:text-stbl-shell/25"
              : active
                ? "bg-stbl-yolk/20 text-stbl-ink dark:bg-stbl-yolk/15 dark:text-stbl-shell"
                : "text-stbl-wood/90 hover:bg-stbl-surface-warm/80 dark:text-stbl-shell/80 dark:hover:bg-stbl-800"
          }`;
          if (item.disabled) {
            return (
              <span key={item.label} className={cls}>
                <span className="flex w-5 shrink-0 justify-center opacity-70">{item.icon}</span>
                {item.label}
                <span className="ml-auto text-[10px] font-normal text-stbl-wood/40">
                  soon
                </span>
              </span>
            );
          }
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className={cls}
            >
              <span className="flex w-5 shrink-0 justify-center">{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-stbl-straw/25 p-4 dark:border-stbl-700">
        <p className="text-[10px] font-medium lowercase tracking-wider text-stbl-wood/50 dark:text-stbl-shell/45">
          Community
        </p>
        <div className="mt-2 flex gap-3 text-stbl-wood/70 dark:text-stbl-shell/60">
          <a
            href="https://x.com/qorbdotfun"
            target="_blank"
            rel="noreferrer"
            aria-label="QORB on X"
            className="text-sm transition hover:text-stbl-orange"
          >
            <XIcon className="h-4 w-4" />
          </a>
        </div>
        <div className="mt-3 flex flex-wrap gap-x-2 gap-y-1 text-[10px] lowercase text-stbl-wood/50 dark:text-stbl-shell/40">
          <Link href="/docs" onClick={onNavigate} className="hover:text-stbl-orange hover:underline">
            docs
          </Link>
          <span>·</span>
          <Link href="/terms" onClick={onNavigate} className="hover:text-stbl-orange hover:underline">
            terms
          </Link>
          <span>·</span>
          <Link href="/privacy" onClick={onNavigate} className="hover:text-stbl-orange hover:underline">
            privacy
          </Link>
        </div>
      </div>
    </aside>
  );
}
