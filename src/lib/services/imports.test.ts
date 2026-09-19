import { beforeEach, describe, expect, it } from "vitest";
import { resetRateLimits } from "@/lib/api/rate-limit";
import { getRepository } from "@/lib/store";
import type { SessionUser } from "@/types";
import { createCase } from "./cases";
import { checkPostAvailability, deleteImportedPost, importPost } from "./imports";
import { getActiveProvider } from "./source";

const analyst: SessionUser = { id: "USR-002", username: "analyst", name: "Analis Demo", role: "analyst" };
const reviewer: SessionUser = { id: "USR-003", username: "reviewer", name: "Peninjau Demo", role: "reviewer" };
const admin: SessionUser = { id: "USR-001", username: "admin", name: "Admin Demo", role: "admin" };

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
const seen: string[] = [];
const fakeFetch = (async (url: string | URL | Request) => {
  const u = String(url);
  seen.push(u);
  if (u.startsWith("https://www.youtube.com/oembed")) {
    return json({ title: "Video uji", author_name: "Kanal Uji", author_url: "https://www.youtube.com/@kanaluji", thumbnail_url: "https://i.ytimg.com/vi/abc/hqdefault.jpg" });
  }
  if (u.startsWith("https://publish.x.com/oembed")) {
    return json({ author_name: "Uji", author_url: "https://x.com/uji", html: '<blockquote><p lang="id">Halo &amp; selamat #pagi</p>&mdash; Uji</blockquote>' });
  }
  return new Response("nope", { status: 400 });
}) as typeof fetch;
const deps = { fetch: fakeFetch, now: () => new Date("2026-09-19T03:00:00Z") };

beforeEach(() => {
  resetRateLimits();
  seen.length = 0;
});

describe("importPost", () => {
  it("adds a YouTube video with real metadata, unknown metrics and a canonical URL", async () => {
    const res = await importPost(analyst, { url: "https://youtu.be/dQw4w9WgXcQ?si=abc" }, deps);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.value).toMatchObject({
      id: "IMP-YOUTUBE-dQw4w9WgXcQ",
      platform: "youtube",
      url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      text: "Video uji",
      mediaType: "video",
      metricsKnown: false,
      dateKnown: false,
      importedBy: "USR-002",
    });
    expect(res.value.provenance).toMatchObject({ collectionMethod: "manual_import", isMock: false, source: "oembed:youtube" });
    // SSRF: only the allowlisted oEmbed host is contacted, with a rebuilt URL (not the pasted one)
    expect(seen).toHaveLength(1);
    expect(seen[0]).toMatch(/^https:\/\/www\.youtube\.com\/oembed\?/);
    expect(seen[0]).not.toContain("si=abc");
  });

  it("extracts the tweet text, and keeps Instagram/Threads working without any metadata call", async () => {
    const x = await importPost(analyst, { url: "https://twitter.com/uji/status/1234567890" }, deps);
    expect(x.ok && x.value.text).toBe("Halo & selamat #pagi");
    expect(x.ok && x.value.hashtags).toEqual(["#pagi"]);

    seen.length = 0;
    const ig = await importPost(analyst, { url: "https://www.instagram.com/reel/C0dE12345/", caption: "keterangan yang disalin" }, deps);
    expect(ig.ok && ig.value.text).toBe("keterangan yang disalin");
    expect(seen).toHaveLength(0);
  });

  it("stores entered metrics as known and never invents the ones left blank", async () => {
    const res = await importPost(analyst, { url: "https://www.threads.com/@akun.uji/post/C1a2B3c4", views: "1500", likes: "", postedAt: "2026-09-10" }, deps);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.value).toMatchObject({ views: 1500, likes: 0, metricsKnown: true, dateKnown: true, createdAt: "2026-09-10T00:00:00.000Z" });
  });

  it("rejects unsupported links with a reason, duplicates, and negative numbers", async () => {
    const bad = await importPost(analyst, { url: "https://vm.tiktok.com/ZMabc/" }, deps);
    expect(bad).toMatchObject({ ok: false });
    if (!bad.ok) expect(bad.error).toMatch(/pendek/i);
    expect(await importPost(analyst, { url: "https://example.com/x" }, deps)).toMatchObject({ ok: false });
    expect(await importPost(analyst, { url: "https://x.com/a/status/99", likes: "-5" }, deps)).toMatchObject({ ok: false });

    await importPost(analyst, { url: "https://x.com/a/status/4242" }, deps);
    expect(await importPost(analyst, { url: "https://x.com/other/status/4242" }, deps)).toMatchObject({ ok: false, status: 409 });
  });

  it("only analysts and admins may add links", async () => {
    expect(await importPost(reviewer, { url: "https://x.com/a/status/777" }, deps)).toMatchObject({ ok: false, status: 403 });
  });

  it("imported posts appear in the active provider together with their account", async () => {
    await importPost(analyst, { url: "https://x.com/gabung/status/31337" }, deps);
    const provider = await getActiveProvider();
    const post = await provider.getPost("IMP-X-31337");
    expect(post?.text).toBeTruthy();
    const account = await provider.getAccount(post!.authorId);
    expect(account).toMatchObject({ handle: "@gabung", metricsKnown: false });
  });
});

describe("deleteImportedPost", () => {
  it("owner or admin can delete, others cannot, and posts used by a case are protected", async () => {
    await importPost(analyst, { url: "https://x.com/hapus/status/5001" }, deps);
    expect(await deleteImportedPost(reviewer, "IMP-X-5001")).toMatchObject({ ok: false, status: 403 });

    const c = await createCase(analyst, { title: "Kasus tautan", description: "", platform: "x", category: "Spam", priority: "low", postIds: ["IMP-X-5001"], accountIds: [] });
    expect(c.ok).toBe(true);
    expect(await deleteImportedPost(analyst, "IMP-X-5001")).toMatchObject({ ok: false, status: 409 });

    await importPost(analyst, { url: "https://x.com/hapus/status/5002" }, deps);
    expect(await deleteImportedPost(admin, "IMP-X-5002")).toMatchObject({ ok: true });
    expect(await (await getRepository()).getImported("IMP-X-5002")).toBeNull();
  });
});

describe("checkPostAvailability", () => {
  it("reports what the platform says, saves it on the post, and is honest when it cannot check", async () => {
    await importPost(analyst, { url: "https://www.youtube.com/watch?v=aaaaaaaaaaa" }, deps);
    const ok = await checkPostAvailability(analyst, "IMP-YOUTUBE-aaaaaaaaaaa", deps);
    expect(ok).toMatchObject({ ok: true, value: { status: "available", supported: true } });

    const gone = await checkPostAvailability(analyst, "IMP-YOUTUBE-aaaaaaaaaaa", { fetch: (async () => new Response("", { status: 400 })) as typeof fetch });
    expect(gone).toMatchObject({ ok: true, value: { status: "unavailable" } });
    expect((await (await getRepository()).getImported("IMP-YOUTUBE-aaaaaaaaaaa"))?.post.lastCheck?.status).toBe("unavailable");

    const down = await checkPostAvailability(analyst, "IMP-YOUTUBE-aaaaaaaaaaa", {
      fetch: (async () => {
        throw new Error("offline");
      }) as typeof fetch,
    });
    expect(down).toMatchObject({ ok: true, value: { status: "unknown" } });

    await importPost(analyst, { url: "https://www.instagram.com/p/Cabc12345/" }, deps);
    const ig = await checkPostAvailability(analyst, "IMP-INSTAGRAM-Cabc12345", deps);
    expect(ig).toMatchObject({ ok: true, value: { status: "unknown", supported: false } });
  });
});
