import { describe, expect, it } from "vitest";
import { explainUnsupported, parsePostUrl } from "./parse";

const p = (u: string) => parsePostUrl(u);

describe("parsePostUrl: YouTube", () => {
  it.each([
    "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    "https://youtube.com/watch?v=dQw4w9WgXcQ&t=42s",
    "https://m.youtube.com/watch?v=dQw4w9WgXcQ",
    "https://youtu.be/dQw4w9WgXcQ?si=abc",
    "https://www.youtube.com/embed/dQw4w9WgXcQ",
    "https://www.youtube.com/live/dQw4w9WgXcQ",
  ])("mengenali %s", (u) => {
    const r = p(u)!;
    expect(r).toMatchObject({ platform: "youtube", id: "dQw4w9WgXcQ", aspect: "16:9", isVideo: true });
    expect(r.canonicalUrl).toBe("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
    expect(r.embedUrl).toBe("https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ");
  });

  it("YouTube Shorts berformat vertikal", () => {
    expect(p("https://www.youtube.com/shorts/dQw4w9WgXcQ")).toMatchObject({ aspect: "9:16" });
  });

  it("menolak ID yang tidak valid, kanal, dan hasil pencarian", () => {
    expect(p("https://www.youtube.com/watch?v=pendek")).toBeNull();
    expect(p("https://www.youtube.com/@namakanal")).toBeNull();
    expect(p("https://www.youtube.com/results?search_query=beras")).toBeNull();
  });
});

describe("parsePostUrl: TikTok, X, Instagram, Threads", () => {
  it("TikTok video dengan handle", () => {
    const r = p("https://www.tiktok.com/@scout2015/video/6718335390845095173?is_from_webapp=1")!;
    expect(r).toMatchObject({ platform: "tiktok", id: "6718335390845095173", handle: "scout2015", aspect: "9:16", isVideo: true });
    expect(r.embedUrl).toBe("https://www.tiktok.com/embed/v2/6718335390845095173");
    expect(r.canonicalUrl).toBe("https://www.tiktok.com/@scout2015/video/6718335390845095173");
  });

  it("X dari x.com maupun twitter.com, dan bentuk /i/status", () => {
    expect(p("https://x.com/jack/status/20")).toMatchObject({ platform: "x", id: "20", handle: "jack", canonicalUrl: "https://x.com/jack/status/20" });
    expect(p("https://twitter.com/jack/status/20?s=46")).toMatchObject({ platform: "x", id: "20" });
    expect(p("https://x.com/i/status/1234567890")).toMatchObject({ handle: null, canonicalUrl: "https://x.com/i/status/1234567890" });
    expect(p("https://x.com/jack/status/20")!.embedUrl).toContain("platform.twitter.com/embed/Tweet.html");
    expect(p("https://x.com/jack")).toBeNull();
  });

  it("Instagram: post, reel, tv, dan varian /nama/p/KODE", () => {
    expect(p("https://www.instagram.com/p/CuE2WNQs6vH/")).toMatchObject({ platform: "instagram", id: "CuE2WNQs6vH", isVideo: false, embedUrl: "https://www.instagram.com/p/CuE2WNQs6vH/embed/" });
    expect(p("https://www.instagram.com/reel/CuE2WNQs6vH/?igsh=xx")).toMatchObject({ isVideo: true, embedUrl: "https://www.instagram.com/reel/CuE2WNQs6vH/embed/" });
    expect(p("https://instagram.com/namaakun/p/CuE2WNQs6vH/")).toMatchObject({ id: "CuE2WNQs6vH" });
    expect(p("https://www.instagram.com/namaakun/")).toBeNull();
  });

  it("Threads dari threads.net dan threads.com", () => {
    const a = p("https://www.threads.net/@zuck/post/C0abcdEfGh1")!;
    expect(a).toMatchObject({ platform: "threads", handle: "zuck", id: "C0abcdEfGh1" });
    expect(a.embedUrl).toBe("https://www.threads.com/@zuck/post/C0abcdEfGh1/embed");
    expect(p("https://www.threads.com/@zuck/post/C0abcdEfGh1")).toMatchObject({ platform: "threads" });
    expect(p("https://www.threads.net/@zuck")).toBeNull();
  });
});

describe("keamanan parser", () => {
  it("menolak skema non-web, kredensial di URL, host palsu, dan teks acak", () => {
    for (const bad of [
      "javascript:alert(1)",
      "data:text/html,<script>1</script>",
      "ftp://youtube.com/watch?v=dQw4w9WgXcQ",
      "https://user:pass@www.youtube.com/watch?v=dQw4w9WgXcQ",
      "https://youtube.com.evil.example/watch?v=dQw4w9WgXcQ",
      "https://evil.example/https://youtube.com/watch?v=dQw4w9WgXcQ",
      "bukan url",
      "",
    ]) expect(p(bad), bad).toBeNull();
  });

  it("URL embed hanya pernah mengarah ke host resmi platform", () => {
    const allowed = ["www.youtube-nocookie.com", "www.tiktok.com", "platform.twitter.com", "www.instagram.com", "www.threads.com"];
    for (const u of [
      "https://youtu.be/dQw4w9WgXcQ",
      "https://www.tiktok.com/@a.b/video/12345678901",
      "https://x.com/a/status/1",
      "https://instagram.com/reel/AbCdE12345/",
      "https://threads.net/@a/post/AbCdE12345",
    ]) expect(allowed).toContain(new URL(p(u)!.embedUrl).hostname);
  });

  it("memberi alasan yang jelas saat menolak", () => {
    expect(explainUnsupported("https://vm.tiktok.com/ZMabc/")).toMatch(/pendek TikTok/);
    expect(explainUnsupported("https://bit.ly/abc")).toMatch(/pendek/);
    expect(explainUnsupported("https://www.youtube.com/@kanal")).toMatch(/satu postingan/);
    expect(explainUnsupported("https://contoh.example/x")).toMatch(/tidak didukung/);
    expect(explainUnsupported("bukan url")).toMatch(/tidak valid/);
  });
});
