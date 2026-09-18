import type { Account, Comment, Interaction, Issue, Post } from "@/types";

/**
 * Contract every data source must satisfy. The UI and services only ever
 * talk to this interface, so swapping MockProvider for an official-API
 * provider does not change any page.
 *
 * Additions to the base contract (needed by dashboards and SNA):
 * `listAccounts`, `listComments`, `getInteractions`.
 */
export interface SocialMediaProvider {
  /** Stable identifier, e.g. "mock". */
  readonly id: string;
  /** Human-readable label shown in the UI, e.g. "MOCK / SIMULATED". */
  readonly label: string;
  /** True when data is simulated. Drives the MOCK DATA badge. */
  readonly isMock: boolean;

  /** An empty query returns every post the provider can list. */
  searchPosts(query: string): Promise<Post[]>;
  getPost(id: string): Promise<Post | null>;
  getAccount(id: string): Promise<Account | null>;
  listAccounts(): Promise<Account[]>;
  getComments(postId: string): Promise<Comment[]>;
  listComments(): Promise<Comment[]>;
  getTrendingTopics(): Promise<Issue[]>;
  /** Shares, quotes and other interactions that cannot be derived from posts. */
  getInteractions(): Promise<Interaction[]>;
}
