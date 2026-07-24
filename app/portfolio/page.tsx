import { PortfolioClient } from "@/components/curve/PortfolioClient";

export const metadata = {
  title: "Portfolio — QORB",
};

// PortfolioClient reads launchpadAddress() during render, which throws when
// NEXT_PUBLIC_LAUNCHPAD_ADDRESS is unset — don't prerender at build time.
export const dynamic = "force-dynamic";

export default function PortfolioPage() {
  return (
    <div>
      <h1 className="font-display mb-2 text-2xl font-extrabold text-stbl-ink dark:text-stbl-shell">
        Portfolio
      </h1>
      <p className="mb-6 max-w-2xl text-sm text-stbl-wood/85 dark:text-stbl-shell/70">
        Your holdings, the tokens you created, and the fees you can claim.
      </p>
      <PortfolioClient />
    </div>
  );
}
