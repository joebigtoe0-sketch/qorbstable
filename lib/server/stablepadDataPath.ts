import fs from "fs";
import path from "path";

/**
 * Resolve `stablepad/.data/<filename>` whether Node's cwd is the Next app root
 * (`stablepad/`) or the monorepo root (`launchpad/`). If **both**
 * `cwd/.data/<file>` and `cwd/stablepad/.data/<file>` exist (common in a
 * monorepo), we prefer `stablepad/.data` so an empty or stale **root** `.data`
 * file cannot shadow the real app data.
 */
export function stablepadDataPath(filename: string): string {
  const directly = path.join(process.cwd(), ".data", filename);
  const nested = path.join(process.cwd(), "stablepad", ".data", filename);
  const monorepoApp = fs.existsSync(
    path.join(process.cwd(), "stablepad", "package.json")
  );

  try {
    const hasDirect = fs.existsSync(directly);
    const hasNested = fs.existsSync(nested);

    if (hasDirect && hasNested) {
      return monorepoApp ? nested : directly;
    }
    if (hasDirect) return directly;
    if (hasNested) return nested;

    if (monorepoApp) return nested;

    try {
      const pkg = JSON.parse(
        fs.readFileSync(path.join(process.cwd(), "package.json"), "utf8")
      ) as { name?: string };
      if (pkg.name === "stablepad") return directly;
    } catch {
      /* no package.json at cwd */
    }

    return monorepoApp ? nested : directly;
  } catch {
    return directly;
  }
}

/** Parent `.data` directory for the embedded PGlite database. */
export function stablepadDataDir(): string {
  return path.dirname(stablepadDataPath("curve-pglite"));
}
