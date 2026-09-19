import type { Post } from "@/types";
import { EMBED_PLATFORM_LABEL, parsePostUrl, type EmbedAspect } from "./parse";

export interface PostEmbed {
  embedUrl: string;
  aspect: EmbedAspect;
  platformLabel: string;
  canonicalUrl: string;
  isVideo: boolean;
}

/** Official embed for a post, or null when its URL is not a supported public post (e.g. simulated data). */
export function embedForPost(post: Pick<Post, "url">): PostEmbed | null {
  const p = parsePostUrl(post.url);
  return p ? { embedUrl: p.embedUrl, aspect: p.aspect, platformLabel: EMBED_PLATFORM_LABEL[p.platform], canonicalUrl: p.canonicalUrl, isVideo: p.isVideo } : null;
}
