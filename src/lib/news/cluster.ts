import { createHash } from "node:crypto";
import type { NewsCluster, NewsItem } from "@/types";

/** Common Indonesian function words plus newsroom boilerplate that carry no topic. */
const STOPWORDS = new Set(
  "yang dan di ke dari untuk dengan pada itu ini akan atau oleh dalam sebagai karena bisa tak tidak ada juga jadi kata usai hingga saat para sudah telah kini soal terkait tegaskan sebut ungkap minta bakal sebut beri kasih jelas sampai antara lebih masih mau agar setelah sebelum tentang kepada pun lagi hari baru ingin bahwa oleh".split(" "),
);

export function headlineTokens(title: string): string[] {
  const words = title
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .split(/\s+/)
    .filter(Boolean);
  return [...new Set(words.filter((w) => !STOPWORDS.has(w) && (w.length >= 4 || /^\d+$/.test(w))))];
}

function similarity(a: Set<string>, b: Set<string>): { jaccard: number; shared: number } {
  let shared = 0;
  for (const t of a) if (b.has(t)) shared++;
  const union = a.size + b.size - shared;
  return { jaccard: union ? shared / union : 0, shared };
}

interface Options {
  threshold?: number;
  minShared?: number;
  windowHours?: number;
}

/**
 * Groups headlines about the same story from DIFFERENT outlets (union-find
 * over token overlap). The result is a heuristic: unrelated stories that share
 * names can be merged, and a story worded very differently can be missed.
 * Every story becomes a cluster, including single-outlet ones.
 */
export function clusterNews(items: NewsItem[], { threshold = 0.3, minShared = 2, windowHours = 36 }: Options = {}): NewsCluster[] {
  const tokens = items.map((i) => new Set(headlineTokens(i.title)));
  const times = items.map((i) => Date.parse(i.publishedAt));
  const parent = items.map((_, i) => i);
  const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  const windowMs = windowHours * 3_600_000;

  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      if (items[i].source === items[j].source) continue;
      if (Math.abs(times[i] - times[j]) > windowMs) continue;
      const { jaccard, shared } = similarity(tokens[i], tokens[j]);
      if (shared >= minShared && jaccard >= threshold) parent[find(i)] = find(j);
    }
  }

  const groups = new Map<number, NewsItem[]>();
  items.forEach((item, i) => groups.set(find(i), [...(groups.get(find(i)) ?? []), item]));

  const clusters: NewsCluster[] = [];
  for (const members of groups.values()) {
    const sorted = [...members].sort((a, b) => a.publishedAt.localeCompare(b.publishedAt));
    clusters.push({
      id: createHash("sha1").update(sorted[0].link).digest("hex").slice(0, 12),
      headline: sorted[0].title,
      items: sorted,
      outlets: [...new Set(sorted.map((m) => m.source))],
      firstAt: sorted[0].publishedAt,
      latestAt: sorted[sorted.length - 1].publishedAt,
    });
  }
  // most outlets first, then most recent
  return clusters.sort((a, b) => b.outlets.length - a.outlets.length || b.latestAt.localeCompare(a.latestAt));
}

/** Case-insensitive match on headline, snippet or outlet name. */
export function searchClusters(clusters: NewsCluster[], query: string): NewsCluster[] {
  const q = query.trim().toLowerCase();
  if (!q) return clusters;
  return clusters.filter((c) => c.items.some((i) => `${i.title} ${i.summary} ${i.source}`.toLowerCase().includes(q)));
}
