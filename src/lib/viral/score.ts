import type { Post } from "@/types";

/**
 * Engagement-based "viral" ranking for posts. It measures how fast a post is
 * attracting interaction, not whether it is true or harmful.
 *   engagement = likes + 2 × comments + 3 × shares   (shares spread content most)
 *   velocity   = engagement per hour since posting
 *   score      = 0–100, log-scaled against the fastest post in the set
 */
export const engagementOf = (p: Pick<Post, "likes" | "comments" | "shares">) => p.likes + 2 * p.comments + 3 * p.shares;

export interface ViralInfo {
  engagement: number;
  velocity: number;
  score: number;
}

export function viralScores(posts: Pick<Post, "id" | "likes" | "comments" | "shares" | "createdAt">[], now: number): Map<string, ViralInfo> {
  const raw = posts.map((p) => {
    const hours = Math.max(1, (now - Date.parse(p.createdAt)) / 3_600_000);
    const engagement = engagementOf(p);
    return { id: p.id, engagement, velocity: engagement / hours };
  });
  const max = Math.max(1, ...raw.map((r) => Math.log10(1 + r.velocity)));
  return new Map(raw.map((r) => [r.id, { engagement: r.engagement, velocity: Math.round(r.velocity), score: Math.round((100 * Math.log10(1 + r.velocity)) / max) }]));
}
