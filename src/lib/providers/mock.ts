import accountsJson from "@/data/mock-accounts.json";
import commentsJson from "@/data/mock-comments.json";
import issuesJson from "@/data/mock-issues.json";
import networkJson from "@/data/mock-network.json";
import postsJson from "@/data/mock-posts.json";
import type { Account, Comment, Interaction, Issue, Post, Provenance } from "@/types";
import type { SocialMediaProvider } from "./interface";

type Raw<T> = Omit<T, "provenance">;

const provenance: Provenance = {
  source: "mock-dataset",
  collectionMethod: "simulated",
  collectedAt: "2026-09-18T00:00:00Z",
  isMock: true,
};

const stamp = <T extends object>(rows: unknown): T[] =>
  (rows as Raw<T>[]).map((row) => ({ ...row, provenance }) as unknown as T);

const accounts = stamp<Account>(accountsJson);
const posts = stamp<Post>(postsJson);
const comments = stamp<Comment>(commentsJson);
const issues = stamp<Issue>(issuesJson);
const interactions = stamp<Interaction>(networkJson);

const accountById = new Map(accounts.map((a) => [a.id, a]));

/** Simulated data only. Never represents live social media content. */
export const mockProvider: SocialMediaProvider = {
  id: "mock",
  label: "MOCK / SIMULASI",
  isMock: true,

  async searchPosts(query) {
    const q = query.trim().toLowerCase();
    if (!q) return posts;
    return posts.filter((post) => {
      const handle = accountById.get(post.authorId)?.handle ?? "";
      return [post.id, post.text, post.url, handle, ...post.hashtags].some((field) =>
        field.toLowerCase().includes(q),
      );
    });
  },

  async getPost(id) {
    return posts.find((p) => p.id === id) ?? null;
  },

  async getAccount(id) {
    return accountById.get(id) ?? null;
  },

  async listAccounts() {
    return accounts;
  },

  async getComments(postId) {
    return comments.filter((c) => c.postId === postId);
  },

  async listComments() {
    return comments;
  },

  async getTrendingTopics() {
    return issues;
  },

  async getInteractions() {
    return interactions;
  },
};
