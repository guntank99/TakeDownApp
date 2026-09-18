import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { updateCaseAction } from "@/app/(app)/actions";
import { RiskBreakdown } from "@/components/analysis/AnalysisCard";
import { DataTable } from "@/components/tables/DataTable";
import { PostsTable, type PostRow } from "@/components/tables/PostsTable";
import { Badge, ConfidenceMeter, PlatformBadge } from "@/components/ui/badges";
import { Card, Flash, KeyValue, Notice, PageHeader } from "@/components/ui/layout";
import { accountAgeDays } from "@/lib/analysis/account";
import { verifySession } from "@/lib/auth/dal";
import { can } from "@/lib/auth/permissions";
import { getAnalysisContext } from "@/lib/services/analysis";
import { listCases } from "@/lib/services/cases";
import { formatDate, formatNumber } from "@/lib/utils/format";

export async function generateMetadata({ params }: PageProps<"/accounts/[id]">): Promise<Metadata> {
  const { id } = await params;
  return { title: `Account ${id}` };
}

export default async function AccountDetailPage({ params, searchParams }: PageProps<"/accounts/[id]">) {
  const user = await verifySession();
  const { id } = await params;
  const sp = await searchParams;
  const ctx = await getAnalysisContext();
  const account = ctx.accountById.get(id);
  if (!account) notFound();
  const an = ctx.accountAnalysis.get(id)!;
  const metrics = ctx.network.metrics[id];
  const cluster = metrics ? ctx.network.clusters.find((c) => c.index === metrics.community) : undefined;

  // strongest connections, from the relationship graph
  const strength = new Map<string, number>();
  for (const e of ctx.network.graph.edges) {
    const other = e.source === id ? e.target : e.target === id ? e.source : null;
    if (other) strength.set(other, (strength.get(other) ?? 0) + e.weight);
  }
  const nodeById = new Map(ctx.network.graph.nodes.map((n) => [n.id, n]));
  const neighbors = [...strength].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([nid, w]) => ({ node: nodeById.get(nid)!, weight: w }));

  const posts = ctx.posts.filter((p) => p.authorId === id);
  const rows: PostRow[] = posts.map((post) => ({ post, handle: account.handle, analysis: ctx.postAnalysis.get(post.id)! }));
  const openCases = listCases().filter((c) => c.status !== "CLOSED" && !c.accountIds.includes(id));

  return (
    <div className="space-y-6">
      <PageHeader
        title={account.displayName}
        description={`${account.handle} — indicators about behaviour and network position. They are not conclusions about the person behind the account.`}
        mock={account.provenance.isMock}
        actions={<PlatformBadge platform={account.platform} />}
      />
      <Flash searchParams={sp} />

      <Card title="Profile" description="Observed data">
        <KeyValue
          items={[
            { label: "Account ID", value: account.id },
            { label: "Created", value: `${formatDate(account.createdAt)} (${accountAgeDays(account, ctx.now)} days)` },
            { label: "Verified", value: account.verified ? "Yes" : "No" },
            { label: "Followers / following", value: `${formatNumber(account.followers)} / ${formatNumber(account.following)}` },
            { label: "Posts per day", value: account.postsPerDay },
            { label: "Profile completeness", value: `${account.profileCompleteness}%` },
          ]}
        />
      </Card>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card
            title="Account authenticity indicators"
            action={an.authenticityLabel === "Potentially Inauthentic" ? <Badge tone="warning">POTENTIALLY INAUTHENTIC</Badge> : <Badge>NO STRONG CONCERNS</Badge>}
            description={`Concern score ${an.authenticityConcern}/100. Each signal is an indicator; several together raise the concern.`}
          >
            <DataTable
              caption="Authenticity signals"
              rows={an.signals}
              rowKey={(s) => s.key}
              columns={[
                { header: "Indicator", cell: (s) => s.label },
                { header: "Value", cell: (s) => s.value },
                { header: "Flagged", cell: (s) => (s.flagged ? <Badge tone="warning">YES · +{s.weight}</Badge> : <span className="text-slate-500">no</span>) },
                { header: "Why it matters", className: "max-w-xs whitespace-normal text-slate-400", cell: (s) => s.note },
              ]}
            />
            {an.impersonation.detected ? (
              <div className="mt-4"><Notice tone="warning">
                {an.impersonation.label}: {an.impersonation.reason} <ConfidenceMeter value={an.impersonation.confidence} />
              </Notice></div>
            ) : null}
          </Card>

          <Card title="Network indicators" description="Neutral descriptions of connections in the available data">
            <KeyValue
              items={[
                { label: "Network role", value: an.networkRole ?? "No notable role" },
                { label: "Degree centrality", value: an.degreeCentrality.toFixed(3) },
                { label: "Betweenness", value: (metrics?.betweenness ?? 0).toFixed(3) },
                { label: "Cluster", value: cluster ? `${cluster.name} (${cluster.nodeCount} nodes)` : "—" },
              ]}
            />
            {neighbors.length ? (
              <ul className="mt-3 space-y-1 text-sm text-slate-300">
                {neighbors.map((n) => (
                  <li key={n.node.id}>
                    {n.node.type === "account" ? <Link href={`/accounts/${n.node.id}`} className="text-sky-400 hover:underline">{n.node.label}</Link> : n.node.label}{" "}
                    <span className="text-xs text-slate-500">{n.node.type} · weight {n.weight}</span>
                  </li>
                ))}
              </ul>
            ) : null}
            <p className="mt-3 text-xs text-slate-500">A highly connected account is not necessarily a leader or a controller; the graph shows connections, not intent.</p>
          </Card>
        </div>
        <div><RiskBreakdown risk={an.risk} title="Account risk" /></div>
      </div>

      <Card title={`Posts by this account (${posts.length})`}>
        <PostsTable rows={rows} variant="review" />
      </Card>

      {can(user.role, "case:update") && openCases.length ? (
        <Card title="Add to a case">
          <form action={updateCaseAction} className="flex flex-wrap items-end gap-3">
            <input type="hidden" name="addAccountId" value={id} />
            <input type="hidden" name="returnTo" value={`/accounts/${id}`} />
            <div>
              <label htmlFor="caseId" className="mb-1 block text-xs text-slate-400">Case</label>
              <select id="caseId" name="caseId" required className="rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-sm text-slate-100">
                {openCases.map((c) => <option key={c.id} value={c.id}>{c.id} — {c.title.slice(0, 60)}</option>)}
              </select>
            </div>
            <button type="submit" className="rounded-lg bg-sky-500 px-4 py-1.5 text-sm font-semibold text-slate-950 hover:bg-sky-400">Add to case</button>
          </form>
        </Card>
      ) : null}
    </div>
  );
}
