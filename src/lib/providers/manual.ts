import type { SocialMediaProvider } from "./interface";

/**
 * The base source in live mode when no official API is configured: it has no
 * data of its own. Everything shown comes from links the team adds by hand
 * (see composite.ts). Nothing here is simulated.
 */
export const manualProvider: SocialMediaProvider = {
  id: "manual",
  label: "TAUTAN MANUAL",
  isMock: false,
  async searchPosts() { return []; },
  async getPost() { return null; },
  async getAccount() { return null; },
  async listAccounts() { return []; },
  async getComments() { return []; },
  async listComments() { return []; },
  async getTrendingTopics() { return []; },
  async getInteractions() { return []; },
};
