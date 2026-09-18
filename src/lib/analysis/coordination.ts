import type { Post } from "@/types";
import { textSimilarity } from "./text";

export interface CoordinationInfo {
  groupId: number;
  /** Distinct accounts that posted near-identical text in the window. */
  accounts: number;
  posts: number;
}

interface Options {
  similarity?: number; // Jaccard threshold
  windowHours?: number;
  minAccounts?: number;
  maxPosts?: number; // safety cap: comparison is O(n²)
}

/**
 * Finds groups of near-duplicate posts published by different accounts
 * within a time window — a common indicator of coordinated amplification.
 * It is an indicator only: organic sharing of a news headline can look alike.
 */
export function findCoordinatedGroups(
  posts: Pick<Post, "id" | "authorId" | "text" | "createdAt">[],
  { similarity = 0.8, windowHours = 48, minAccounts = 3, maxPosts = 2000 }: Options = {},
): Map<string, CoordinationInfo> {
  const items = posts.slice(0, maxPosts).map((p) => ({ ...p, t: Date.parse(p.createdAt) }));
  const parent = items.map((_, i) => i);
  const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  const windowMs = windowHours * 3600e3;

  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      if (items[i].authorId === items[j].authorId) continue;
      if (Math.abs(items[i].t - items[j].t) > windowMs) continue;
      if (textSimilarity(items[i].text, items[j].text) >= similarity) {
        parent[find(i)] = find(j);
      }
    }
  }

  const groups = new Map<number, number[]>();
  items.forEach((_, i) => {
    const root = find(i);
    groups.set(root, [...(groups.get(root) ?? []), i]);
  });

  const result = new Map<string, CoordinationInfo>();
  let groupId = 0;
  for (const members of groups.values()) {
    const accounts = new Set(members.map((i) => items[i].authorId)).size;
    if (accounts < minAccounts) continue;
    groupId++;
    for (const i of members) {
      result.set(items[i].id, { groupId, accounts, posts: members.length });
    }
  }
  return result;
}

/** Coordination-risk points (0–15) from the number of accounts in the group. */
export function coordinationPoints(accounts: number): number {
  if (accounts < 3) return 0;
  return Math.round(15 * Math.min(1, (accounts - 1) / 4));
}
