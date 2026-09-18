import { mockProvider } from "./mock";
import type { SocialMediaProvider } from "./interface";
import { createYouTubeProvider } from "./youtube";

export type { SocialMediaProvider } from "./interface";

let youtube: { key: string; provider: SocialMediaProvider } | undefined;

/**
 * The single place that decides which provider is active.
 *
 *   DATA_PROVIDER=mock      (default) simulated data
 *   DATA_PROVIDER=youtube   official YouTube Data API v3; needs YOUTUBE_API_KEY
 *
 * If a real provider is requested but not configured we fall back to the mock
 * provider (clearly labelled) rather than failing or faking live data.
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
    console.warn("DATA_PROVIDER=youtube but YOUTUBE_API_KEY is not set; using the mock provider.");
  }
  return mockProvider;
}
