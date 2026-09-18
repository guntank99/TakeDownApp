import { HttpError, readJson, withApi } from "@/lib/api/handler";
import { getAnalysisContext } from "@/lib/services/analysis";
import { formatZodError, snaSchema } from "@/lib/validation/schemas";

/** POST /api/sna {nodeTypes?, platform?, minDegree?}: filtered graph with metrics, roles and clusters. */
export const POST = withApi({}, async (req) => {
  const parsed = snaSchema.safeParse(await readJson(req));
  if (!parsed.success) throw new HttpError(400, formatZodError(parsed.error));
  const { nodeTypes = ["account", "hashtag", "topic"], platform, minDegree = 0 } = parsed.data;
  const { network, source } = await getAnalysisContext();

  const nodes = network.graph.nodes
    .filter((n) => nodeTypes.includes(n.type) && (!platform || n.type !== "account" || n.platform === platform) && network.metrics[n.id].degree >= minDegree)
    .map((n) => ({ ...n, metrics: network.metrics[n.id], role: network.roles[n.id] ?? null }));
  const ids = new Set(nodes.map((n) => n.id));
  return {
    nodes,
    edges: network.graph.edges.filter((e) => ids.has(e.source) && ids.has(e.target)),
    density: network.density,
    clusters: network.clusters,
    source,
    note: "Peran menggambarkan koneksi pada data yang tersedia, bukan niat atau kendali.",
  };
});
