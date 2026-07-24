import { CurveExplorer } from "@/components/curve/CurveExplorer";
import { TrendingBar } from "@/components/curve/TrendingBar";

export default function HomePage() {
  return (
    <div className="space-y-8 pb-8">
      <TrendingBar />
      <CurveExplorer />
      <section className="text-center text-xs lowercase text-stbl-shell/45">
        <p>
          direct link:{" "}
          <code className="rounded bg-stbl-800 px-1.5 py-0.5 font-mono text-stbl-shell">
            /coin/&lt;address&gt;
          </code>
        </p>
      </section>
    </div>
  );
}
