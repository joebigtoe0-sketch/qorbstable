"use client";

import { useState } from "react";

import { StableRightRail } from "@/components/StableRightRail";
import { StableSidebar } from "@/components/StableSidebar";
import { StableTopBar } from "@/components/StableTopBar";

export function StableShell({ children }: { children: React.ReactNode }) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-stbl-canvas dark:bg-stbl-950">
      <StableSidebar open={menuOpen} onNavigate={() => setMenuOpen(false)} />
      {menuOpen ? (
        <button
          type="button"
          className="fixed inset-0 z-30 bg-stbl-ink/35 backdrop-blur-[1px] dark:bg-black/50 md:hidden"
          aria-label="Close menu"
          onClick={() => setMenuOpen(false)}
        />
      ) : null}
      <div className="flex min-h-screen min-w-0 flex-1 flex-col">
        <StableTopBar onMenu={() => setMenuOpen(true)} />
        <div className="flex min-h-0 flex-1 overflow-hidden">
          <main className="min-h-0 min-w-0 flex-1 overflow-y-auto px-4 py-6 lg:px-8">
            <div className="mx-auto w-full max-w-6xl">{children}</div>
          </main>
          <StableRightRail />
        </div>
      </div>
    </div>
  );
}
