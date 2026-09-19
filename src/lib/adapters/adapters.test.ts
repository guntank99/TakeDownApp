import { describe, expect, it } from "vitest";
import { EMBED_PLATFORMS, parsePostUrl } from "@/lib/embed/parse";
import type { PolicyRule, ReportSubmission } from "@/types";
import { ADAPTERS, adapterForUrl, getAdapter } from "./index";

const SAMPLES = {
  youtube: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
  instagram: "https://www.instagram.com/reel/C0dE12345/",
  facebook: "https://www.facebook.com/zuck/posts/10102577175875681",
  threads: "https://www.threads.com/@akun.uji/post/C1a2B3c4",
  tiktok: "https://www.tiktok.com/@scout2015/video/6718335390845095173",
  x: "https://x.com/jack/status/20",
} as const;

describe("platform adapters", () => {
  it("there is exactly one adapter per supported platform", () => {
    expect(Object.keys(ADAPTERS).sort()).toEqual([...EMBED_PLATFORMS].sort());
    for (const p of EMBED_PLATFORMS) expect(getAdapter(p).platform).toBe(p);
  });

  it.each(Object.entries(SAMPLES))("%s: validates its own link, extracts the id, and finds itself from the URL", (platform, url) => {
    const adapter = getAdapter(platform as keyof typeof SAMPLES);
    expect(adapter.validateUrl(url)).toMatchObject({ ok: true });
    expect(adapter.extractContentId(url)).toBeTruthy();
    expect(adapterForUrl(url)?.platform).toBe(platform);
  });

  it("rejects a link from another platform, with a clear code", () => {
    const res = getAdapter("youtube").validateUrl(SAMPLES.x);
    expect(res).toMatchObject({ ok: false, code: "UNSUPPORTED_PLATFORM" });
  });

  it("distinguishes INVALID_URL from UNSUPPORTED_PLATFORM and never fetches unknown domains", () => {
    expect(getAdapter("x").validateUrl("bukan url")).toMatchObject({ ok: false, code: "INVALID_URL" });
    expect(getAdapter("x").validateUrl("https://example.com/post/1")).toMatchObject({ ok: false, code: "UNSUPPORTED_PLATFORM" });
    expect(adapterForUrl("https://example.com/post/1")).toBeNull();
    expect(adapterForUrl("javascript:alert(1)")).toBeNull();
  });

  it("never claims it can file a report: submission always needs the user, via the official page", () => {
    for (const p of EMBED_PLATFORMS) {
      const g = getAdapter(p).submitReport();
      expect(g.mode).toBe("USER_ACTION_REQUIRED");
      expect(g.steps.length).toBeGreaterThanOrEqual(3);
      expect(g.steps.join(" ")).toMatch(/catat/i);
    }
  });

  it("maps a submission to a case stage without inventing one", () => {
    const sub = (outcome?: ReportSubmission["outcome"]): ReportSubmission => ({ platform: "x", method: "official_page", submittedAt: "t", submittedBy: "u", status: "SUBMITTED", outcome });
    const a = getAdapter("x");
    expect(a.getCaseStatus(null)).toBe("not_submitted");
    expect(a.getCaseStatus(sub())).toBe("under_review");
    expect(a.getCaseStatus(sub("removed"))).toBe("action_taken");
    expect(a.getCaseStatus(sub("restricted"))).toBe("action_taken");
    expect(a.getCaseStatus(sub("rejected"))).toBe("rejected");
    expect(a.getCaseStatus(sub("no_action"))).toBe("no_action");
  });

  it("policy categories come only from the policy library entries of that platform", () => {
    const rules = [
      { platform: "x", category: "Harassment" },
      { platform: "x", category: "Spam" },
      { platform: "youtube", category: "Copyright" },
    ] as PolicyRule[];
    expect(getAdapter("x").getPolicyCategories(rules).sort()).toEqual(["Harassment", "Spam"]);
    expect(getAdapter("tiktok").getPolicyCategories(rules)).toEqual([]);
  });
});

describe("Facebook links", () => {
  it("parses post, video, reel, watch and permalink forms into a canonical URL and an official plugin embed", () => {
    const post = parsePostUrl("https://m.facebook.com/zuck/posts/10102577175875681?ref=x&__cft__=y");
    expect(post).toMatchObject({ platform: "facebook", id: "10102577175875681", handle: "zuck", isVideo: false, aspect: "tall", canonicalUrl: "https://www.facebook.com/zuck/posts/10102577175875681" });
    expect(post!.embedUrl).toMatch(/^https:\/\/www\.facebook\.com\/plugins\/post\.php\?href=https%3A%2F%2Fwww\.facebook\.com%2Fzuck%2Fposts%2F10102577175875681/);

    expect(parsePostUrl("https://www.facebook.com/watch/?v=10153231379946729")).toMatchObject({ isVideo: true, aspect: "16:9" });
    expect(parsePostUrl("https://www.facebook.com/reel/1234567890123")!.embedUrl).toMatch(/plugins\/video\.php/);
    expect(parsePostUrl("https://www.facebook.com/facebook/videos/10153231379946729/")).toMatchObject({ isVideo: true, handle: "facebook" });
    expect(parsePostUrl("https://www.facebook.com/permalink.php?story_fbid=1234567890&id=100000123456")).toMatchObject({ platform: "facebook" });
  });

  it("rejects profile pages, short links, and lookalike hosts", () => {
    expect(parsePostUrl("https://www.facebook.com/zuck")).toBeNull();
    expect(parsePostUrl("https://fb.watch/abcdef/")).toBeNull();
    expect(parsePostUrl("https://facebook.com.evil.example/zuck/posts/10102577175875681")).toBeNull();
    expect(parsePostUrl("https://www.facebook.com/zuck/posts/../../evil")).toBeNull();
  });
});
