import Image from "next/image";

import { CurveLaunchForm } from "@/components/curve/CurveLaunchForm";

export const metadata = {
  title: "launch a coin — qorb",
};

export default function LaunchPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-4 pb-8">
      {/* header */}
      <div className="flex items-center gap-4 rounded-2xl border border-stbl-700 bg-stbl-900/60 p-5">
        <Image src="/logo.png" alt="" width={48} height={48} className="rounded-full" />
        <div className="min-w-0">
          <h1 className="font-display text-2xl font-extrabold lowercase text-stbl-shell">
            launch a coin
          </h1>
          <p className="mt-0.5 text-sm lowercase text-stbl-shell/60">
            straight onto the bonding curve — a real uniswap v3 pool, liquidity
            locked forever, no upfront capital. fill it to{" "}
            <span className="font-mono text-stbl-yolk">$12,000</span> and it
            graduates.
          </p>
        </div>
        <span className="ml-auto hidden shrink-0 rounded-full bg-stbl-yolk/15 px-3 py-1 font-mono text-[10px] font-bold lowercase text-stbl-yolk sm:block">
          free · gas only
        </span>
      </div>
      <CurveLaunchForm />
    </div>
  );
}
