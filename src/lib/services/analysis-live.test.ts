import { beforeAll, describe, expect, it } from "vitest";

// Live mode: no simulated data at all, so the workspace holds only the links the team added.
process.env.APP_MODE = "live";
delete process.env.DATABASE_URL;

const fetchNothing = (async () => new Response("", { status: 400 })) as typeof fetch;

describe("analysis in live mode (only imported links)", () => {
  beforeAll(() => {
    expect(process.env.APP_MODE).toBe("live");
  });

  it("an empty workspace analyses to empty results", async () => {
    const { getAnalysisContext } = await import("./analysis");
    const ctx = await getAnalysisContext();
    expect(ctx.posts).toEqual([]);
    expect(ctx.source.isMock).toBe(false);
  });

  it("works with a few imported posts, some from the same author", async () => {
    const { getAnalysisContext } = await import("./analysis");
    const { importPost } = await import("./imports");
    const { getRepository } = await import("@/lib/store");
    const admin = (await (await getRepository()).listUsers()).at(0) ?? { id: "USR-001", username: "admin", name: "Admin", role: "admin" as const };
    const user = { id: admin.id, username: admin.username, name: admin.name, role: "admin" as const };
    const deps = { fetch: fetchNothing, now: () => new Date() };
    for (const url of ["https://x.com/aaa/status/1000001", "https://x.com/aaa/status/1000002", "https://www.instagram.com/reel/C0dE12345/", "https://www.tiktok.com/@zzz/video/7000000000000000001"]) {
      const r = await importPost(user, { url, caption: "teks uji" }, deps);
      expect(r.ok, url).toBe(true);
    }
    const ctx = await getAnalysisContext();
    expect(ctx.posts).toHaveLength(4);
    expect(ctx.accounts.length).toBeGreaterThanOrEqual(3);
    for (const p of ctx.posts) expect(ctx.postAnalysis.get(p.id)).toBeTruthy();
  });
});
