import type {
  Account,
  Comment,
  EdgeType,
  Interaction,
  Issue,
  NetEdge,
  NetNode,
  NetworkGraph,
  Post,
} from "@/types";

interface BuildInput {
  accounts: Account[];
  posts: Post[];
  comments: Comment[];
  issues: Issue[];
  interactions: Interaction[];
}

/**
 * Builds the relationship graph from observed data only:
 *  - mention / reply / hashtag edges are derived from posts and comments
 *  - share / quote / interaction edges come from provider interaction data
 * Node types: account, post (only posts that were shared/quoted), hashtag, topic.
 */
export function buildNetwork({ accounts, posts, comments, issues, interactions }: BuildInput): NetworkGraph {
  const nodes = new Map<string, NetNode>();
  const edges = new Map<string, NetEdge>();

  const addNode = (n: NetNode) => nodes.has(n.id) || nodes.set(n.id, n);
  const addEdge = (source: string, target: string, type: EdgeType) => {
    if (source === target || !nodes.has(source) || !nodes.has(target)) return;
    const id = `${type}|${source}|${target}`;
    const existing = edges.get(id);
    if (existing) existing.weight++;
    else edges.set(id, { id, source, target, type, weight: 1 });
  };

  for (const a of accounts) addNode({ id: a.id, type: "account", label: a.handle, platform: a.platform });
  const idByHandle = new Map(accounts.map((a) => [a.handle.toLowerCase(), a.id]));
  const postById = new Map(posts.map((p) => [p.id, p]));

  for (const p of posts) {
    for (const h of p.mentions) {
      const target = idByHandle.get(h.toLowerCase());
      if (target) addEdge(p.authorId, target, "mention");
    }
    for (const tag of p.hashtags) {
      const id = `tag:${tag.toLowerCase()}`;
      addNode({ id, type: "hashtag", label: tag });
      addEdge(p.authorId, id, "hashtag");
    }
  }

  for (const c of comments) {
    const post = postById.get(c.postId);
    if (post) addEdge(c.authorId, post.authorId, "reply");
  }

  for (const issue of issues) {
    const tagId = `tag:${issue.hashtag.toLowerCase()}`;
    if (!nodes.has(tagId)) continue;
    const topicId = `topic:${issue.id}`;
    addNode({ id: topicId, type: "topic", label: issue.title });
    addEdge(tagId, topicId, "hashtag");
  }

  const authored = new Set<string>();
  for (const i of interactions) {
    if (i.postId && postById.has(i.postId) && i.type !== "interaction") {
      const postNodeId = `post:${i.postId}`;
      addNode({ id: postNodeId, type: "post", label: i.postId });
      addEdge(i.sourceAccountId, postNodeId, i.type);
      if (!authored.has(postNodeId)) {
        authored.add(postNodeId);
        addEdge(postById.get(i.postId)!.authorId, postNodeId, "interaction");
      }
    } else {
      addEdge(i.sourceAccountId, i.targetAccountId, i.type);
    }
  }

  return { nodes: [...nodes.values()], edges: [...edges.values()] };
}
