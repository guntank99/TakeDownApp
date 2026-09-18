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
  return { title: `Akun ${id}` };
}

const NODE_TYPE_LABEL = { account: "akun", post: "postingan", hashtag: "tagar", topic: "topik" } as const;

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
  const inauthentic = an.authenticityLabel === "Berpotensi Tidak Autentik";

  return (
    <div className="space-y-6">
      <PageHeader
        title={account.displayName}
        description={`${account.handle}: indikator perilaku dan posisi dalam jaringan. Ini bukan kesimpulan tentang orang di balik akun.`}
        mock={account.provenance.isMock}
        actions={<PlatformBadge platform={account.platform} />}
      />
      <Flash searchParams={sp} />

      <Card title="Profil" description="Data hasil pengamatan">
        <KeyValue
          items={[
            { label: "ID akun", value: account.id },
            { label: "Dibuat", value: `${formatDate(account.createdAt)} (${accountAgeDays(account, ctx.now)} hari)` },
            { label: "Terverifikasi", value: account.verified ? "Ya" : "Tidak" },
            { label: "Pengikut / mengikuti", value: `${formatNumber(account.followers)} / ${formatNumber(account.following)}` },
            { label: "Posting per hari", value: account.postsPerDay },
            { label: "Kelengkapan profil", value: `${account.profileCompleteness}%` },
          ]}
        />
      </Card>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="min-w-0 space-y-6 lg:col-span-2">
          <Card
            title="Indikator autentisitas akun"
            action={inauthentic ? <Badge tone="warning">BERPOTENSI TIDAK AUTENTIK</Badge> : <Badge>TIDAK ADA KEKHAWATIRAN KUAT</Badge>}
            description={`Skor kekhawatiran ${an.authenticityConcern}/100. Setiap sinyal hanyalah indikator; beberapa sinyal sekaligus meningkatkan kekhawatiran.`}
          >
            <DataTable
              caption="Sinyal autentisitas"
              rows={an.signals}
              rowKey={(s) => s.key}
              columns={[
                { header: "Indikator", cell: (s) => s.label },
                { header: "Nilai", cell: (s) => s.value },
                { header: "Ditandai", cell: (s) => (s.flagged ? <Badge tone="warning">YA · +{s.weight}</Badge> : <span className="text-slate-500">tidak</span>) },
                { header: "Mengapa penting", className: "max-w-xs whitespace-normal text-slate-400", cell: (s) => s.note },
              ]}
            />
            {an.impersonation.detected ? (
              <div className="mt-4"><Notice tone="warning">
                {an.impersonation.label}: {an.impersonation.reason} <ConfidenceMeter value={an.impersonation.confidence} />
              </Notice></div>
            ) : null}
          </Card>

          <Card title="Indikator jaringan" description="Deskripsi netral tentang koneksi pada data yang tersedia">
            <KeyValue
              items={[
                { label: "Peran jaringan", value: an.networkRole ?? "Tidak ada peran yang menonjol" },
                { label: "Sentralitas derajat", value: an.degreeCentrality.toFixed(3) },
                { label: "Betweenness", value: (metrics?.betweenness ?? 0).toFixed(3) },
                { label: "Klaster", value: cluster ? `${cluster.name} (${cluster.nodeCount} simpul)` : "—" },
              ]}
            />
            {neighbors.length ? (
              <ul className="mt-3 space-y-1 text-sm text-slate-300">
                {neighbors.map((n) => (
                  <li key={n.node.id}>
                    {n.node.type === "account" ? <Link href={`/accounts/${n.node.id}`} className="text-sky-400 hover:underline">{n.node.label}</Link> : n.node.label}{" "}
                    <span className="text-xs text-slate-500">{NODE_TYPE_LABEL[n.node.type]} · bobot {n.weight}</span>
                  </li>
                ))}
              </ul>
            ) : null}
            <p className="mt-3 text-xs text-slate-500">Akun yang sangat terhubung belum tentu pemimpin atau pengendali; graf hanya menunjukkan koneksi, bukan niat.</p>
          </Card>
        </div>
        <div className="min-w-0"><RiskBreakdown risk={an.risk} title="Risiko akun" /></div>
      </div>

      <Card title={`Postingan akun ini (${posts.length})`}>
        <PostsTable rows={rows} variant="review" />
      </Card>

      {can(user.role, "case:update") && openCases.length ? (
        <Card title="Tambahkan ke kasus">
          <form action={updateCaseAction} className="flex flex-wrap items-end gap-3">
            <input type="hidden" name="addAccountId" value={id} />
            <input type="hidden" name="returnTo" value={`/accounts/${id}`} />
            <div>
              <label htmlFor="caseId" className="mb-1 block text-xs text-slate-400">Kasus</label>
              <select id="caseId" name="caseId" required className="rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-sm text-slate-100">
                {openCases.map((c) => <option key={c.id} value={c.id}>{c.id}: {c.title.slice(0, 60)}</option>)}
              </select>
            </div>
            <button type="submit" className="rounded-lg bg-sky-500 px-4 py-1.5 text-sm font-semibold text-slate-950 hover:bg-sky-400">Tambahkan ke kasus</button>
          </form>
        </Card>
      ) : null}
    </div>
  );
}
