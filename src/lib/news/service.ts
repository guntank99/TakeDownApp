import "server-only";

import type { NewsCluster, NewsItem } from "@/types";
import { clusterNews } from "./cluster";
import { NEWS_FEEDS, type NewsFeed } from "./feeds";
import { decodeFeed, parseFeed } from "./parse";

export interface FeedStatus {
  name: string;
  url: string;
  ok: boolean;
  count: number;
  error?: string;
}

export interface NewsResult {
  enabled: boolean;
  clusters: NewsCluster[];
  feeds: FeedStatus[];
  totalItems: number;
  fetchedAt: string;
}

const TTL_MS = 10 * 60_000;
const TIMEOUT_MS = 8_000;
const MAX_BYTES = 3_000_000;
const MAX_AGE_HOURS = 48;
const USER_AGENT = "SocialSentinel/1.0 (RSS reader for media monitoring)";

type FetchLike = typeof fetch;

export function newsEnabled(): boolean {
  return process.env.NEWS_ENABLED !== "false";
}

async function loadFeed(feed: NewsFeed, fetchImpl: FetchLike): Promise<{ status: FeedStatus; items: NewsItem[] }> {
  const base = { name: feed.name, url: feed.url };
  try {
    const res = await fetchImpl(feed.url, {
      headers: { "User-Agent": USER_AGENT, Accept: "application/rss+xml, application/xml, text/xml" },
      signal: AbortSignal.timeout(TIMEOUT_MS),
      redirect: "follow",
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const type = res.headers.get("content-type") ?? "";
    if (!/xml/i.test(type)) throw new Error("bukan XML");
    const bytes = await res.arrayBuffer();
    if (bytes.byteLength > MAX_BYTES) throw new Error("respons terlalu besar");
    const items = parseFeed(decodeFeed(bytes, type), feed);
    return { status: { ...base, ok: true, count: items.length }, items };
  } catch (error) {
    return { status: { ...base, ok: false, count: 0, error: error instanceof Error ? error.message : "gagal" }, items: [] };
  }
}

async function build(fetchImpl: FetchLike, now: number): Promise<NewsResult> {
  const loaded = await Promise.all(NEWS_FEEDS.map((f) => loadFeed(f, fetchImpl)));
  const cutoff = now - MAX_AGE_HOURS * 3_600_000;

  // the same article can appear in two feeds of one outlet: keep it once
  const byLink = new Map<string, NewsItem>();
  for (const { items } of loaded) {
    for (const item of items) {
      const t = Date.parse(item.publishedAt);
      if (t >= cutoff && t <= now + 3_600_000) byLink.set(item.link, item);
    }
  }
  const items = [...byLink.values()];
  return {
    enabled: true,
    clusters: clusterNews(items),
    feeds: loaded.map((l) => l.status),
    totalItems: items.length,
    fetchedAt: new Date(now).toISOString(),
  };
}

const g = globalThis as unknown as { __sentinelNews?: { at: number; value: Promise<NewsResult> } };

/**
 * Trending Indonesian news, cached for 10 minutes. If every feed fails the
 * last good result is kept instead of an empty page.
 */
export async function getNews(fetchImpl: FetchLike = fetch, now = Date.now()): Promise<NewsResult> {
  if (!newsEnabled()) return { enabled: false, clusters: [], feeds: [], totalItems: 0, fetchedAt: new Date(now).toISOString() };

  const cached = g.__sentinelNews;
  if (cached && now - cached.at < TTL_MS) return cached.value;

  const previous = cached?.value;
  const value = build(fetchImpl, now).then(async (fresh) => {
    if (fresh.totalItems === 0 && previous) {
      const old = await previous.catch(() => null);
      if (old && old.totalItems > 0) return { ...old, feeds: fresh.feeds };
    }
    return fresh;
  });
  g.__sentinelNews = { at: now, value };
  value.catch(() => {
    if (g.__sentinelNews?.value === value) g.__sentinelNews = undefined;
  });
  return value;
}

/** Test helper. */
export function resetNewsCache() {
  g.__sentinelNews = undefined;
}
