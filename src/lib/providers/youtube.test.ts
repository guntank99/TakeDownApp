import { afterEach, describe, expect, it, vi } from "vitest";
import { getProvider } from "./index";
import { createYouTubeProvider, ytAccountId, ytPostId } from "./youtube";

const KEY = "test-key-should-never-leak";

const video = (id: string, channelId: string, title: string, extra: object = {}) => ({
  id,
  snippet: { title, description: "desc #Topic", channelId, publishedAt: "2026-09-10T10:00:00Z" },
  statistics: { viewCount: "1000", likeCount: "50", commentCount: "7" },
  ...extra,
});
const channel = (id: string) => ({
  id,
  snippet: { title: `Channel ${id}`, description: "About", customUrl: `@chan${id}`, publishedAt: "2020-01-01T00:00:00Z", thumbnails: { default: {} } },
  statistics: { subscriberCount: "1200", videoCount: "300" },
});

/** Routes fake API responses by endpoint name and records every request. */
function fakeFetch(routes: Record<string, unknown | ((u: URL) => unknown)>, status = 200) {
  const calls: { url: URL; headers: Record<string, string> }[] = [];
  const fn = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input));
    calls.push({ url, headers: Object.fromEntries(Object.entries((init?.headers as Record<string, string>) ?? {})) });
    const key = url.pathname.split("/").pop()!;
    const body = routes[key];
    const payload = typeof body === "function" ? (body as (u: URL) => unknown)(url) : body;
    return new Response(JSON.stringify(payload ?? { items: [] }), { status, headers: { "Content-Type": "application/json" } });
  });
  return { fn: fn as unknown as typeof fetch, calls };
}

describe("YouTube provider", () => {
  it("maps videos to posts and channels to accounts, marking data as non-mock", async () => {
    const { fn } = fakeFetch({
      videos: { items: [video("v1", "c1", "First video"), video("v2", "c2", "Second")] },
      channels: { items: [channel("c1"), channel("c2")] },
    });
    const p = createYouTubeProvider(KEY, fn);
    const posts = await p.searchPosts("");
    expect(p.isMock).toBe(false);
    expect(posts).toHaveLength(2);
    expect(posts[0]).toMatchObject({
      id: ytPostId("v1"), platform: "youtube", authorId: ytAccountId("c1"), views: 1000, likes: 50, comments: 7,
      url: "https://www.youtube.com/watch?v=v1", hashtags: ["#Topic"],
    });
    expect(posts[0].provenance).toMatchObject({ isMock: false, collectionMethod: "official_api", source: "youtube-data-api-v3" });

    const accounts = await p.listAccounts();
    expect(accounts.map((a) => a.id)).toEqual([ytAccountId("c1"), ytAccountId("c2")]);
    expect(accounts[0]).toMatchObject({ followers: 1200, displayName: "Channel c1", handle: "@chanc1", profileCompleteness: 100 });
  });

  it("sends the key in a header and never in the URL", async () => {
    const { fn, calls } = fakeFetch({ videos: { items: [video("v1", "c1", "x")] }, channels: { items: [channel("c1")] } });
    await createYouTubeProvider(KEY, fn).searchPosts("");
    expect(calls.length).toBeGreaterThan(0);
    for (const c of calls) {
      expect(c.headers["x-goog-api-key"]).toBe(KEY);
      expect(c.url.toString()).not.toContain(KEY);
      expect(c.url.searchParams.has("key")).toBe(false);
    }
  });

  it("searches, then fetches statistics for the found ids", async () => {
    const { fn, calls } = fakeFetch({
      search: { items: [{ id: { videoId: "v9" } }, { id: {} }] },
      videos: (u: URL) => ({ items: u.searchParams.get("id") === "v9" ? [video("v9", "c9", "Found")] : [] }),
      channels: { items: [channel("c9")] },
    });
    const posts = await createYouTubeProvider(KEY, fn).searchPosts("dam release");
    expect(posts.map((p) => p.id)).toEqual(["YT-v9"]);
    expect(calls[0].url.searchParams.get("q")).toBe("dam release");
    expect(calls[0].url.searchParams.get("type")).toBe("video");
  });

  it("caches identical requests to save quota", async () => {
    const { fn } = fakeFetch({ videos: { items: [video("v1", "c1", "x")] }, channels: { items: [channel("c1")] } });
    const p = createYouTubeProvider(KEY, fn);
    await p.searchPosts("");
    const first = (fn as unknown as { mock: { calls: unknown[] } }).mock.calls.length;
    await p.searchPosts("");
    expect((fn as unknown as { mock: { calls: unknown[] } }).mock.calls.length).toBe(first);
  });

  it("maps comment threads and tolerates disabled comments", async () => {
    const threads = { items: [{ id: "t1", snippet: { videoId: "v1", topLevelComment: { snippet: { authorChannelId: { value: "cX" }, textDisplay: "nice", publishedAt: "2026-09-11T00:00:00Z" } } } }] };
    const ok = createYouTubeProvider(KEY, fakeFetch({ commentThreads: threads }).fn);
    expect((await ok.getComments("YT-v1"))[0]).toMatchObject({ id: "YTCM-t1", postId: "YT-v1", authorId: "YTC-cX", text: "nice" });

    const disabled = createYouTubeProvider(KEY, fakeFetch({ commentThreads: { error: { message: "The video identified by the videoId parameter has disabled comments." } } }, 403).fn);
    await expect(disabled.getComments("YT-v1")).resolves.toEqual([]);
  });

  it("raises a clear error without leaking the key", async () => {
    const { fn } = fakeFetch({ videos: { error: { message: "quotaExceeded" } } }, 429);
    const err = await createYouTubeProvider(KEY, fn).searchPosts("").catch((e: Error) => e);
    expect(err).toBeInstanceOf(Error);
    expect((err as Error).message).toMatch(/failed \(429\).*quotaExceeded/);
    expect((err as Error).message).not.toContain(KEY);
  });

  it("derives trending topics from hashtags shared by 2+ videos, and has no interactions", async () => {
    const { fn } = fakeFetch({ videos: { items: [video("a", "c1", "One #Wow"), video("b", "c2", "Two #Wow"), video("c", "c3", "Three #Solo")] } });
    const p = createYouTubeProvider(KEY, fn);
    const topics = await p.getTrendingTopics();
    expect(topics.map((t) => t.hashtag)).toContain("#Wow");
    expect(topics.find((t) => t.hashtag === "#Solo")).toBeUndefined();
    expect(topics[0].series).toHaveLength(7);
    expect(await p.getInteractions()).toEqual([]);
  });

  it("returns null for an unknown post", async () => {
    const p = createYouTubeProvider(KEY, fakeFetch({ videos: { items: [] } }).fn);
    expect(await p.getPost("YT-missing")).toBeNull();
  });
});

describe("getProvider selection", () => {
  const TOUCHED = ["DATA_PROVIDER", "YOUTUBE_API_KEY"] as const;
  const original = Object.fromEntries(TOUCHED.map((k) => [k, process.env[k]]));
  afterEach(() => {
    for (const k of TOUCHED) {
      if (original[k] === undefined) delete process.env[k];
      else process.env[k] = original[k];
    }
    vi.restoreAllMocks();
  });

  it("defaults to the mock provider", () => {
    delete process.env.DATA_PROVIDER;
    expect(getProvider().id).toBe("mock");
  });

  it("uses YouTube only when requested AND configured", () => {
    process.env.DATA_PROVIDER = "youtube";
    process.env.YOUTUBE_API_KEY = "k";
    expect(getProvider().id).toBe("youtube");
  });

  it("falls back to mock (never fakes live data) when the key is missing", () => {
    process.env.DATA_PROVIDER = "youtube";
    delete process.env.YOUTUBE_API_KEY;
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const p = getProvider();
    expect(p.id).toBe("mock");
    expect(p.isMock).toBe(true);
  });
});
