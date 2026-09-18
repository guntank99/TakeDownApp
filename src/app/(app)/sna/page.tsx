import type { Metadata } from "next";
import Link from "next/link";
import { NetworkGraph, type GraphNodeData } from "@/components/network/NetworkGraph";
import { DataTable } from "@/components/tables/DataTable";
import { PlatformBadge } from "@/components/ui/badges";
import { Card, Notice, PageHeader } from "@/components/ui/layout";
import { verifySession } from "@/lib/auth/dal";
import { getAnalysisContext } from "@/lib/services/analysis";
import { PLATFORM_COLOR, PLATFORM_LABEL } from "@/lib/utils/platforms";

export const metadata: Metadata = { title: "SNA" };

const TYPE_COLOR = { post: "#94a3b8", hashtag: "#e2e8f0", topic: "#64748b" } as const;
/** First slots of the categorical palette; further clusters share a neutral grey. */
const CLUSTER_COLORS = ["#3987e5", "#d95926", "#199e70", "#c98500", "#d55181", "#008300", "#9085e9", "#e66767"];

export default async function SnaPage() {
  await verifySession();
  const ctx = await getAnalysisContext();
  const { network } = ctx;
  const clusterByIndex = new Map(network.clusters.map((c, i) => [c.index, { ...c, color: CLUSTER_COLORS[i] ?? "#64748b" }]));

  const nodes: GraphNodeData[] = network.graph.nodes.map((n) => {
    const m = network.metrics[n.id];
    const cluster = clusterByIndex.get(m.community);
    const pos = network.positions[n.id] ?? { x: 0, y: 0 };
    return {
      id: n.id, label: n.label, type: n.type, platform: n.platform,
      color: n.type === "account" && n.platform ? PLATFORM_COLOR[n.platform] : TYPE_COLOR[n.type as keyof typeof TYPE_COLOR],
      clusterColor: cluster?.color ?? "#475569",
      degree: m.degree, degreeCentrality: m.degreeCentrality, betweenness: m.betweenness,
      clusterName: cluster?.name ?? null, role: network.roles[n.id] ?? null, x: pos.x, y: pos.y,
    };
  });

  const accounts = network.graph.nodes.filter((n) => n.type === "account");
  const topBy = (key: "degree" | "betweenness") =>
    [...accounts].sort((a, b) => network.metrics[b.id][key] - network.metrics[a.id][key]).slice(0, 8);
  const roleRows = accounts.filter((a) => network.roles[a.id]).sort((a, b) => network.metrics[b.id].degree - network.metrics[a.id].degree);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Social network analysis"
        description="Relationships derived from mentions, replies, hashtags, shares and quotes in the available data. Metrics describe connections, not intent."
        mock={ctx.source.isMock}
      />

      <section aria-label="Network summary" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ["Nodes", network.graph.nodes.length],
          ["Edges", network.graph.edges.length],
          ["Density", network.density.toFixed(3)],
          ["Clusters", network.clusters.length],
        ].map(([label, value]) => (
          <div key={label} className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
            <p className="text-xs uppercase tracking-wider text-slate-500">{label}</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums text-slate-50">{value}</p>
          </div>
        ))}
      </section>

      <NetworkGraph
        nodes={nodes}
        edges={network.graph.edges.map((e) => ({ id: e.id, source: e.source, target: e.target, type: e.type, weight: e.weight }))}
        clusters={network.clusters.map((c, i) => ({ name: c.name, nodeCount: c.nodeCount, color: CLUSTER_COLORS[i] ?? "#64748b" }))}
      />

      <Notice tone="warning">
        Interpretation: a highly central account is described as a “Highly Connected Account” or “Potential Network Hub”. This is based only on the available data and does not show that the account leads, controls or coordinates anything.
      </Notice>

      <section aria-label="Clusters" className="grid gap-4 md:grid-cols-2">
        {network.clusters.map((c, i) => (
          <Card
            key={c.name}
            title={c.name}
            description={`${c.nodeCount} nodes · dominant topic: ${c.dominantTopic ?? "—"}`}
            action={<span className="size-3 rounded-full" style={{ background: CLUSTER_COLORS[i] ?? "#64748b" }} aria-hidden="true" />}
          >
            <dl className="grid gap-2 text-sm sm:grid-cols-2">
              <div><dt className="text-xs text-slate-500">Dominant hashtags</dt><dd className="text-slate-200">{c.dominantHashtags.join(" ") || "—"}</dd></div>
              <div><dt className="text-xs text-slate-500">Sentiment of members&apos; posts</dt><dd className="text-slate-200">+{c.sentiment.positive} / ={c.sentiment.neutral} / −{c.sentiment.negative}</dd></div>
              <div className="sm:col-span-2"><dt className="text-xs text-slate-500">Platforms</dt><dd className="flex flex-wrap gap-2 text-slate-200">{Object.entries(c.platforms).map(([p, n]) => <span key={p}>{PLATFORM_LABEL[p as keyof typeof PLATFORM_LABEL]} ×{n}</span>)}</dd></div>
              <div className="sm:col-span-2"><dt className="text-xs text-slate-500">Important nodes</dt><dd className="text-slate-200">{c.importantNodes.map((n) => `${n.label} (${n.degree})`).join(", ")}</dd></div>
            </dl>
          </Card>
        ))}
      </section>

      <section aria-label="Centrality" className="grid gap-4 lg:grid-cols-2">
        {(["degree", "betweenness"] as const).map((key) => (
          <Card key={key} title={key === "degree" ? "Highest degree centrality" : "Highest betweenness centrality"} description="Accounts only">
            <DataTable
              caption={`Accounts by ${key}`}
              rows={topBy(key)}
              rowKey={(n) => n.id}
              columns={[
                { header: "Account", cell: (n) => <Link href={`/accounts/${n.id}`} className="text-sky-400 hover:underline">{n.label}</Link> },
                { header: "Platform", cell: (n) => (n.platform ? <PlatformBadge platform={n.platform} /> : "—") },
                { header: key === "degree" ? "Degree centrality" : "Betweenness", className: "text-right tabular-nums", cell: (n) => (key === "degree" ? network.metrics[n.id].degreeCentrality : network.metrics[n.id].betweenness).toFixed(3) },
                { header: "Connections", className: "text-right tabular-nums", cell: (n) => network.metrics[n.id].degree },
              ]}
            />
          </Card>
        ))}
      </section>

      <Card title="Accounts with a notable network role" description="Top decile of degree or betweenness centrality">
        <DataTable
          caption="Network roles"
          rows={roleRows}
          rowKey={(n) => n.id}
          empty="No accounts stand out in this network."
          columns={[
            { header: "Account", cell: (n) => <Link href={`/accounts/${n.id}`} className="text-sky-400 hover:underline">{n.label}</Link> },
            { header: "Role", cell: (n) => network.roles[n.id] },
            { header: "Cluster", cell: (n) => clusterByIndex.get(network.metrics[n.id].community)?.name ?? "—" },
          ]}
        />
      </Card>
    </div>
  );
}
