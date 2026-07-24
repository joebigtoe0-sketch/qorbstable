import { Suspense } from "react";

import { SwapClient } from "@/components/swap/SwapClient";

export const metadata = {
  title: "Swap — QORB",
};

// SwapClient reads AMM addresses + search params at render time.
export const dynamic = "force-dynamic";

export default function SwapPage() {
  return (
    <div className="pb-8 pt-4">
      <Suspense>
        <SwapClient />
      </Suspense>
    </div>
  );
}
