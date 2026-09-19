import { isLive } from "@/lib/config/mode";
import { manualProvider } from "./manual";
import { mockProvider } from "./mock";
import type { SocialMediaProvider } from "./interface";
import { createYouTubeProvider } from "./youtube";

export type { SocialMediaProvider } from "./interface";

let youtube: { key: string; provider: SocialMediaProvider } | undefined;

/**
 * The BASE data source (before links added by the team are layered on top; see
 * services/source.ts).
 *
 *   DATA_PROVIDER=youtube   official YouTube Data API v3; needs YOUTUBE_API_KEY
 *   otherwise               demo mode → simulated data; live mode → empty (links only)
 *
 * Simulated data is never used in live mode: an unconfigured live deployment
 * shows an honest empty state instead of fake content.
 */
export function getProvider(): SocialMediaProvider {
  if (process.env.DATA_PROVIDER === "youtube") {
    const key = process.env.YOUTUBE_API_KEY;
    if (key) {
      if (youtube?.key !== key) {
        youtube = { key, provider: createYouTubeProvider(key, fetch, process.env.YOUTUBE_REGION || "ID") };
      }
      return youtube.provider;
    }
    console.warn("DATA_PROVIDER=youtube but YOUTUBE_API_KEY is not set; falling back.");
  }
  return isLive() ? manualProvider : mockProvider;
}
