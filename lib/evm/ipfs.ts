import { cleanEnv } from "@/lib/cleanEnv";

/** Resolve ipfs:// URIs through a public gateway for the browser. */
export function ipfsToHttp(uri: string): string {
  if (!uri) return "";
  if (!uri.startsWith("ipfs://")) return uri;
  const gateway =
    cleanEnv(process.env.NEXT_PUBLIC_IPFS_GATEWAY)?.replace(/\/$/, "") ??
    "https://gateway.pinata.cloud";
  return `${gateway}/ipfs/${uri.slice("ipfs://".length)}`;
}
