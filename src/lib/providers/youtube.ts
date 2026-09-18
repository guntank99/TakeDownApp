import "server-only";

import type { Account, Comment, Interaction, Issue, Post, Provenance } from "@/types";
import type { SocialMediaProvider } from "./interface";

/**
 * Official YouTube Data API v3 provider (read-only). Uses only public data
 * an API key can access. It cannot see private data, and it does not act on
 * accounts or content in any way.
 *
 * Quota: search.list costs 100 units, most other calls 1 unit (default daily
 * quota 10,000). Results are cached briefly to save quota.
 * Compliance: use of this data is subject to the YouTube API Services Terms
 * of Service and Google's Developer Policies — review them before production.
 */

const API = "https://www.googleapis.com/youtube/v3";
const CACHE_TTL_MS = 5 * 60_000;
const MAX_RESULTS = 25;
const COMMENT_VIDEOS = 10;

type FetchLike = typeof fetch;

interface Video {
  id: string;
  snippet: { title: string; description: string; channelId: string; publishedAt: string };
  statistics?: { viewCount?: string; likeCount?: string; commentCount?: string };
}
interface Channel {
  id: string;
  snippet: { title: string; description?: string; customUrl?: string; publishedAt: string; thumbnails?: Record<string, unknown> };
  statistics?: { subscriberCount?: string; videoCount?: string; hiddenSubscriberCount?: boolean };
}
interface CommentThread {
  id: string;
  snippet: { videoId: string; topLevelComment: { snippet: { authorChannelId?: { value: string }; textDisplay: string; publishedAt: string } } };
}

const num = (v: string | undefined) => (v ? Number.parseInt(v, 10) || 0 : 0);
const hashtags = (text: string) => [...new Set(text.match(/#[\p{L}\p{N}_]+/gu) ?? [])];

export const ytPostId = (videoId: string) => `YT-${videoId}`;
export const ytAccountId = (channelId: string) => `YTC-${channelId}`;

export function createYouTubeProvider(apiKey: string, fetchImpl: FetchLike = fetch, region = "ID"): SocialMediaProvider {
  const cache = new Map<string, { at: number; value: unknown }>();
  const channels = new Map<string, Account>();
  let lastVideos: Video[] = [];

  const provenance = (): Provenance => ({
    source: "youtube-data-api-v3",
    collectionMethod: "official_api",
    collectedAt: new Date().toISOString(),
    isMock: false,
  });

  /** GET with the key in a header (never in the URL), cached by URL. */
  async function call<T>(path: string, params: Record<string, string>): Promise<T> {
    const url = `${API}/${path}?${new URLSearchParams(params)}`;
    const hit = cache.get(url);
    if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.value as T;

    const res = await fetchImpl(url, { headers: { "x-goog-api-key": apiKey, Accept: "application/json" } });
    if (!res.ok) {
      let detail = "";
      try {
        detail = ((await res.json()) as { error?: { message?: string } }).error?.message ?? "";
      } catch {
        /* body was not JSON */
      }
      // Never include the URL or headers: they identify the project/key.
      throw new Error(`YouTube API ${path} failed (${res.status})${detail ? `: ${detail}` : ""}`);
    }
    const value = (await res.json()) as T;
    cache.set(url, { at: Date.now(), value });
    return value;
  }

  const toPost = (v: Video): Post => {
    const text = `${v.snippet.title}\n${v.snippet.description}`.trim().slice(0, 1000);
    return {
      id: ytPostId(v.id),
      platform: "youtube",
      url: `https://www.youtube.com/watch?v=${v.id}`,
      authorId: ytAccountId(v.snippet.channelId),
      text,
      mediaType: "video",
      hashtags: hashtags(text),
      mentions: [],
      issueId: null,
      claimId: null,
      createdAt: v.snippet.publishedAt,
      likes: num(v.statistics?.likeCount),
      comments: num(v.statistics?.commentCount),
      shares: 0, // not exposed by the API
      views: num(v.statistics?.viewCount),
      status: "new",
      provenance: provenance(),
    };
  };

  const toAccount = (c: Channel, now = Date.now()): Account => {
    const ageDays = Math.max(1, (now - Date.parse(c.snippet.publishedAt)) / 86_400_000);
    const filled = [c.snippet.title, c.snippet.description, c.snippet.customUrl, c.snippet.thumbnails].filter(Boolean).length;
    return {
      id: ytAccountId(c.id),
      platform: "youtube",
      handle: c.snippet.customUrl ?? c.snippet.title,
      displayName: c.snippet.title,
      createdAt: c.snippet.publishedAt,
      followers: c.statistics?.hiddenSubscriberCount ? 0 : num(c.statistics?.subscriberCount),
      following: 0, // not exposed
      verified: false, // not exposed
      postsPerDay: Math.round((num(c.statistics?.videoCount) / ageDays) * 10) / 10,
      profileCompleteness: Math.round((filled / 4) * 100),
      contentRepetition: 0, // unknown from the API
      activitySpike: false, // unknown from the API
      provenance: provenance(),
    };
  };

  async function loadChannels(ids: string[]): Promise<void> {
    const missing = [...new Set(ids)].filter((id) => !channels.has(ytAccountId(id)));
    for (let i = 0; i < missing.length; i += 50) {
      const batch = missing.slice(i, i + 50);
      const res = await call<{ items?: Channel[] }>("channels", { part: "snippet,statistics", id: batch.join(","), maxResults: "50" });
      for (const c of res.items ?? []) channels.set(ytAccountId(c.id), toAccount(c));
    }
  }

  async function videosByIds(ids: string[]): Promise<Video[]> {
    if (ids.length === 0) return [];
    const res = await call<{ items?: Video[] }>("videos", { part: "snippet,statistics", id: ids.slice(0, 50).join(",") });
    return res.items ?? [];
  }

  const toComment = (t: CommentThread): Comment => ({
    id: `YTCM-${t.id}`,
    postId: ytPostId(t.snippet.videoId),
    authorId: ytAccountId(t.snippet.topLevelComment.snippet.authorChannelId?.value ?? "unknown"),
    text: t.snippet.topLevelComment.snippet.textDisplay,
    createdAt: t.snippet.topLevelComment.snippet.publishedAt,
    provenance: provenance(),
  });

  const provider: SocialMediaProvider = {
    id: "youtube",
    label: "YOUTUBE DATA API v3 (RESMI)",
    isMock: false,

    async searchPosts(query) {
      const q = query.trim();
      let videos: Video[];
      if (q) {
        const found = await call<{ items?: { id?: { videoId?: string } }[] }>("search", {
          part: "snippet", type: "video", q, maxResults: String(MAX_RESULTS), order: "relevance",
        });
        videos = await videosByIds((found.items ?? []).map((i) => i.id?.videoId).filter((x): x is string => Boolean(x)));
      } else {
        const res = await call<{ items?: Video[] }>("videos", {
          part: "snippet,statistics", chart: "mostPopular", regionCode: region, maxResults: String(MAX_RESULTS),
        });
        videos = res.items ?? [];
      }
      lastVideos = videos;
      await loadChannels(videos.map((v) => v.snippet.channelId));
      return videos.map(toPost);
    },

    async getPost(id) {
      const [video] = await videosByIds([id.replace(/^YT-/, "")]);
      if (!video) return null;
      await loadChannels([video.snippet.channelId]);
      return toPost(video);
    },

    async getAccount(id) {
      const channelId = id.replace(/^YTC-/, "");
      await loadChannels([channelId]);
      return channels.get(ytAccountId(channelId)) ?? null;
    },

    async listAccounts() {
      if (channels.size === 0) await provider.searchPosts("");
      return [...channels.values()];
    },

    async getComments(postId) {
      const res = await call<{ items?: CommentThread[] }>("commentThreads", {
        part: "snippet", videoId: postId.replace(/^YT-/, ""), maxResults: "50", textFormat: "plainText", order: "relevance",
      }).catch((e: Error) => {
        // Comments can be disabled on a video; that is not an error for the caller.
        if (/disabled comments|commentsDisabled|\(403\)/i.test(e.message)) return { items: [] as CommentThread[] };
        throw e;
      });
      return (res.items ?? []).map(toComment);
    },

    async listComments() {
      if (lastVideos.length === 0) await provider.searchPosts("");
      const top = [...lastVideos].sort((a, b) => num(b.statistics?.commentCount) - num(a.statistics?.commentCount)).slice(0, COMMENT_VIDEOS);
      return (await Promise.all(top.map((v) => provider.getComments(ytPostId(v.id))))).flat();
    },

    /** "Trending topics" = hashtags that appear on 2+ of the most popular videos. */
    async getTrendingTopics() {
      const res = await call<{ items?: Video[] }>("videos", {
        part: "snippet,statistics", chart: "mostPopular", regionCode: region, maxResults: String(MAX_RESULTS),
      });
      const byTag = new Map<string, Video[]>();
      for (const v of res.items ?? []) {
        for (const tag of hashtags(`${v.snippet.title} ${v.snippet.description}`)) byTag.set(tag, [...(byTag.get(tag) ?? []), v]);
      }
      const issues: Issue[] = [];
      for (const [tag, vids] of byTag) {
        if (vids.length < 2) continue;
        const volume = vids.reduce((s, v) => s + num(v.statistics?.viewCount), 0);
        const first = vids.reduce((m, v) => (v.snippet.publishedAt < m ? v.snippet.publishedAt : m), vids[0].snippet.publishedAt);
        issues.push({
          id: `YTI-${tag.slice(1).toLowerCase()}`,
          title: tag,
          hashtag: tag,
          platforms: ["youtube"],
          volume,
          growth: 0, // the API gives no previous period to compare with
          series: [0, 0, 0, 0, 0, 0, volume],
          status: "monitoring",
          firstDetectedAt: first,
          lastUpdatedAt: new Date().toISOString(),
          provenance: provenance(),
        });
      }
      return issues.sort((a, b) => b.volume - a.volume).slice(0, 20);
    },

    async getInteractions(): Promise<Interaction[]> {
      return []; // shares / quotes are not available through the public API
    },
  };
  return provider;
}
