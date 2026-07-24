/**
 * Strip surrounding quotes from an env value. Railway's raw ENV editor (and
 * some shells) store `KEY="value"` with the quotes INCLUDED — dotenv strips
 * them locally, so the breakage only appears in production. Always read env
 * statically (process.env.X) and pass the value through this.
 */
export function cleanEnv(v: string | undefined): string | undefined {
  const t = v?.trim().replace(/^["']+|["']+$/g, "").trim();
  return t || undefined;
}
