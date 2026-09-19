import type { EmbedPlatform } from "@/lib/embed/parse";
import { parsePostUrl } from "@/lib/embed/parse";
import type { PlatformAdapter } from "./base";
import { facebookAdapter } from "./facebook";
import { instagramAdapter } from "./instagram";
import { threadsAdapter } from "./threads";
import { tiktokAdapter } from "./tiktok";
import { xAdapter } from "./x";
import { youtubeAdapter } from "./youtube";

export type { PlatformAdapter, SubmissionGuidance, UrlCheck } from "./base";

/** Registry: platform → its own adapter. */
export const ADAPTERS: Record<EmbedPlatform, PlatformAdapter> = {
  instagram: instagramAdapter,
  facebook: facebookAdapter,
  threads: threadsAdapter,
  youtube: youtubeAdapter,
  tiktok: tiktokAdapter,
  x: xAdapter,
};

export const getAdapter = (platform: EmbedPlatform): PlatformAdapter => ADAPTERS[platform];

/** Finds the right adapter from a pasted link (never fetches anything). */
export function adapterForUrl(url: string): PlatformAdapter | null {
  const parsed = parsePostUrl(url);
  return parsed ? ADAPTERS[parsed.platform] : null;
}
