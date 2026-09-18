import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { NewsItem } from "@/types";
import { clusterNews, headlineTokens, searchClusters } from "./cluster";
import { cleanText, decodeFeed, parseFeed, safeLink } from "./parse";
import { getNews, resetNewsCache } from "./service";

const NOW = Date.parse("2026-09-19T05:00:00Z");
const rss = (items: string) => `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>x</title>${items}</channel></rss>`;
const item = (title: string, link: string, date = "Sat, 19 Sep 2026 10:00:00 +0700", desc = "Ringkasan berita.") =>
  `<item><title>${title}</title><link>${link}</link><pubDate>${date}</pubDate><description><![CDATA[${desc}]]></description></item>`;

describe("parseFeed", () => {
  it("parses items, strips markup from the snippet and normalises dates to ISO", () => {
    const xml = rss(item("Judul &amp; Berita", "https://a.example/1", "Sat, 19 Sep 2026 10:00:00 +0700", '<img src="x.jpg"/>ANTARA - Isi <b>berita</b> penting.'));
    const [it] = parseFeed(xml, { name: "Antara" });
    expect(it).toMatchObject({ title: "Judul & Berita", source: "Antara", link: "https://a.example/1", publishedAt: "2026-09-19T03:00:00.000Z" });
    expect(it.summary).toBe("ANTARA - Isi berita penting.");
    expect(it.summary).not.toContain("<");
  });

  it("handles a single item (not an array) and CDATA titles", () => {
    const xml = rss("<item><title><![CDATA[Judul CDATA]]></title><link>https://a.example/2</link><pubDate>Sat, 19 Sep 2026 10:00:00 +0700</pubDate></item>");
    expect(parseFeed(xml, { name: "X" })).toHaveLength(1);
  });

  it("skips items with unsafe links, missing titles or invalid dates", () => {
    const xml = rss(
      item("Bahaya", "javascript:alert(1)") + item("", "https://a.example/3") + item("Tanggal rusak", "https://a.example/4", "bukan tanggal") + item("Aman", "https://a.example/5"),
    );
    expect(parseFeed(xml, { name: "X" }).map((i) => i.title)).toEqual(["Aman"]);
  });

  it("returns an empty list for malformed XML or a non-RSS document", () => {
    expect(parseFeed("<html><body>404</body></html>", { name: "X" })).toEqual([]);
    expect(parseFeed("not xml at all", { name: "X" })).toEqual([]);
  });

  it("accepts only http(s) links", () => {
    expect(safeLink("https://a.example/x")).toBe("https://a.example/x");
    expect(safeLink("javascript:alert(1)")).toBeNull();
    expect(safeLink("data:text/html,hi")).toBeNull();
    expect(safeLink(42)).toBeNull();
  });

  it("decodes non-UTF-8 feeds using the declared charset", () => {
    const bytes = Uint8Array.from([...`<?xml version="1.0" encoding="ISO-8859-1"?><t>caf`].map((c) => c.charCodeAt(0)).concat([0xe9]));
    expect(decodeFeed(bytes.buffer)).toContain("café");
    expect(cleanText(null)).toBe("");
  });
});

const news = (title: string, source: string, at = "2026-09-19T01:00:00Z"): NewsItem => ({
  id: `${source}-${title}`.slice(0, 12), title, link: `https://${source.toLowerCase()}.example/${encodeURIComponent(title)}`, source, publishedAt: at, summary: "",
});

describe("clusterNews", () => {
  it("groups the same story from different outlets and ranks by number of outlets", () => {
    const clusters = clusterNews([
      news("Banjir rob rendam permukiman pesisir Semarang", "Antara"),
      news("Permukiman pesisir Semarang terendam banjir rob", "CNN"),
      news("Banjir rob pesisir Semarang, warga mengungsi", "Tempo"),
      news("Timnas menang atas Vietnam di laga persahabatan", "Antara"),
    ]);
    expect(clusters[0].outlets.sort()).toEqual(["Antara", "CNN", "Tempo"]);
    expect(clusters[0].items).toHaveLength(3);
    expect(clusters).toHaveLength(2);
  });

  it("never merges two headlines from the same outlet", () => {
    const clusters = clusterNews([news("Harga beras naik di pasar induk Jakarta", "Antara"), news("Harga beras naik di pasar induk Jakarta pekan ini", "Antara")]);
    expect(clusters).toHaveLength(2);
  });

  it("does not merge unrelated stories or stories far apart in time", () => {
    expect(clusterNews([news("Harga cabai naik di Bandung", "A"), news("Persib menang tipis di kandang", "B")])).toHaveLength(2);
    expect(clusterNews([news("Banjir rob rendam pesisir Semarang", "A", "2026-09-17T01:00:00Z"), news("Banjir rob rendam pesisir Semarang", "B", "2026-09-19T01:00:00Z")])).toHaveLength(2);
  });

  it("drops stopwords and short words when tokenising", () => {
    expect(headlineTokens("Yang di ke dan Banjir 2026 itu")).toEqual(["banjir", "2026"]);
  });

  it("searches headline, snippet and outlet case-insensitively", () => {
    const clusters = clusterNews([{ ...news("Harga beras naik", "Antara"), summary: "Bulog menyiapkan stok" }, news("Persib menang", "Tempo")]);
    expect(searchClusters(clusters, "BERAS")).toHaveLength(1);
    expect(searchClusters(clusters, "bulog")).toHaveLength(1);
    expect(searchClusters(clusters, "tempo")).toHaveLength(1);
    expect(searchClusters(clusters, "  ")).toHaveLength(2);
    expect(searchClusters(clusters, "tidak ada")).toHaveLength(0);
  });
});

/** Fake fetch: only the listed hosts answer; everything else fails like a real outage. */
function fakeFetch(hosts: Record<string, string | { status: number; type?: string; body?: string }>) {
  return vi.fn(async (input: RequestInfo | URL) => {
    const host = new URL(String(input)).host;
    const r = hosts[host];
    if (r === undefined) throw new Error("ECONNREFUSED");
    if (typeof r === "string") return new Response(r, { status: 200, headers: { "Content-Type": "text/xml; charset=utf-8" } });
    return new Response(r.body ?? "", { status: r.status, headers: { "Content-Type": r.type ?? "text/xml" } });
  }) as unknown as typeof fetch;
}

describe("getNews", () => {
  const original = process.env.NEWS_ENABLED;
  beforeEach(resetNewsCache);
  afterEach(() => {
    if (original === undefined) delete process.env.NEWS_ENABLED;
    else process.env.NEWS_ENABLED = original;
  });

  const good = rss(item("Banjir rob rendam pesisir Semarang", "https://www.antaranews.com/berita/1") + item("Berita lama sekali", "https://www.antaranews.com/berita/2", "Mon, 01 Jun 2026 10:00:00 +0700"));

  it("collects items, filters old ones, and reports the status of every feed", async () => {
    const res = await getNews(fakeFetch({ "www.antaranews.com": good, "www.cnnindonesia.com": { status: 500 }, "rss.tempo.co": { status: 200, type: "text/html", body: "<html/>" } }), NOW);
    expect(res.enabled).toBe(true);
    expect(res.totalItems).toBe(1); // the June item is older than 48 h; the duplicate feed of the same outlet is de-duplicated
    expect(res.clusters[0].headline).toContain("Banjir rob");
    expect(res.feeds.find((f) => f.name === "CNN Indonesia")).toMatchObject({ ok: false, error: "HTTP 500" });
    expect(res.feeds.find((f) => f.name === "Tempo")).toMatchObject({ ok: false, error: "bukan XML" });
    expect(res.feeds.filter((f) => f.ok).length).toBeGreaterThan(0);
  });

  it("caches for 10 minutes, then refreshes", async () => {
    const f = fakeFetch({ "www.antaranews.com": good });
    await getNews(f, NOW);
    const calls = (f as unknown as { mock: { calls: unknown[] } }).mock.calls.length;
    await getNews(f, NOW + 60_000);
    expect((f as unknown as { mock: { calls: unknown[] } }).mock.calls.length).toBe(calls);
    await getNews(f, NOW + 11 * 60_000);
    expect((f as unknown as { mock: { calls: unknown[] } }).mock.calls.length).toBeGreaterThan(calls);
  });

  it("keeps the last good result when every feed fails on refresh", async () => {
    await getNews(fakeFetch({ "www.antaranews.com": good }), NOW);
    const later = await getNews(fakeFetch({}), NOW + 11 * 60_000);
    expect(later.totalItems).toBe(1);
    expect(later.feeds.every((f) => !f.ok)).toBe(true);
  });

  it("returns an empty, honest result when nothing is reachable and there is no history", async () => {
    const res = await getNews(fakeFetch({}), NOW);
    expect(res.totalItems).toBe(0);
    expect(res.clusters).toEqual([]);
  });

  it("can be switched off with NEWS_ENABLED=false without any network call", async () => {
    process.env.NEWS_ENABLED = "false";
    const f = fakeFetch({ "www.antaranews.com": good });
    const res = await getNews(f, NOW);
    expect(res.enabled).toBe(false);
    expect((f as unknown as { mock: { calls: unknown[] } }).mock.calls.length).toBe(0);
  });
});
