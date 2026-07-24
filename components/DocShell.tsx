import Link from "next/link";

/** Shared layout + typography for docs and legal pages. */

export function DocShell({
  title,
  updated,
  children,
}: {
  title: string;
  updated?: string;
  children: React.ReactNode;
}) {
  return (
    <article className="max-w-3xl pb-12">
      <h1 className="font-display text-2xl font-extrabold text-stbl-ink dark:text-stbl-shell">
        {title}
      </h1>
      {updated ? (
        <p className="mt-1 text-xs text-stbl-wood/60 dark:text-stbl-shell/50">
          Last updated: {updated}
        </p>
      ) : null}
      <div className="mt-6 space-y-8">{children}</div>
      <p className="mt-10 border-t border-stbl-straw/30 pt-4 text-xs text-stbl-wood/60 dark:border-stbl-700 dark:text-stbl-shell/50">
        Questions? Reach us via the community channels, or see the{" "}
        <Link href="/docs" className="underline hover:text-stbl-orange">
          docs
        </Link>
        ,{" "}
        <Link href="/terms" className="underline hover:text-stbl-orange">
          terms
        </Link>{" "}
        and{" "}
        <Link href="/privacy" className="underline hover:text-stbl-orange">
          privacy policy
        </Link>
        .
      </p>
    </article>
  );
}

export function Section({
  heading,
  children,
}: {
  heading: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h2 className="font-display text-base font-extrabold text-stbl-ink dark:text-stbl-shell">
        {heading}
      </h2>
      <div className="mt-2 space-y-3 text-sm leading-relaxed text-stbl-wood/90 dark:text-stbl-shell/75">
        {children}
      </div>
    </section>
  );
}

export function Callout({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-stbl-yolk/50 bg-stbl-yolk/10 px-4 py-3 text-sm leading-relaxed text-stbl-ink dark:text-stbl-shell">
      {children}
    </div>
  );
}
