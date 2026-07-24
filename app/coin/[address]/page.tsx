import { CoinPageClient } from "@/components/curve/CoinPageClient";

export const metadata = {
  title: "Token — QORB",
};

export default function CoinPage({ params }: { params: { address: string } }) {
  return <CoinPageClient address={params.address.toLowerCase()} />;
}
