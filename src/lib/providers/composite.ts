import type { Account, Post } from "@/types";
import type { SocialMediaProvider } from "./interface";

export interface ImportedLike {
  post: Post;
  account: Account;
}

/**
 * Wraps a base provider and adds the posts the team collected by URL, so the
 * rest of the app (analysis, cases, evidence, dashboards) sees ONE data set.
 * Imported items keep their own provenance (manual_import, not mock).
 */
export function withImports(base: SocialMediaProvider, items: readonly ImportedLike[]): SocialMediaProvider {
  if (items.length === 0) return base;
  const posts = items.map((i) => i.post);
  const accounts = [...new Map(items.map((i) => [i.account.id, i.account])).values()];
  const accountById = new Map(accounts.map((a) => [a.id, a]));
  const postById = new Map(posts.map((p) => [p.id, p]));

  const matches = (post: Post, q: string) => {
    const handle = accountById.get(post.authorId)?.handle ?? "";
    return [post.id, post.text, post.url, handle, ...post.hashtags].some((f) => f.toLowerCase().includes(q));
  };

  return {
    id: `${base.id}+imports`,
    label: base.id === "manual" ? base.label : `${base.label} + TAUTAN MANUAL`,
    isMock: base.isMock,

    async searchPosts(query) {
      const q = query.trim().toLowerCase();
      const own = q ? posts.filter((p) => matches(p, q)) : posts;
      return [...(await base.searchPosts(query)), ...own];
    },
    async getPost(id) {
      return postById.get(id) ?? base.getPost(id);
    },
    async getAccount(id) {
      return accountById.get(id) ?? base.getAccount(id);
    },
    async listAccounts() {
      return [...(await base.listAccounts()), ...accounts];
    },
    getComments: (postId) => base.getComments(postId),
    listComments: () => base.listComments(),
    getTrendingTopics: () => base.getTrendingTopics(),
    getInteractions: () => base.getInteractions(),
  };
}
