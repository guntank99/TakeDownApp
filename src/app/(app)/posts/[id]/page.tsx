import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { updateCaseAction } from "@/app/(app)/actions";
import { AnalysisCard, PolicyCard, RiskBreakdown } from "@/components/analysis/AnalysisCard";
import { DataTable } from "@/components/tables/DataTable";
import { Badge, ConfidenceMeter, PlatformBadge, RiskBadge, SentimentBadge, StatusBadge } from "@/components/ui/badges";
import { Card, Flash, KeyValue, Notice, PageHeader } from "@/components/ui/layout";
import { verifySession } from "@/lib/auth/dal";
import { userName } from "@/lib/auth/directory";
import { can } from "@/lib/auth/permissions";
import { CLAIM_VERDICT_LABEL, MEDIA_TYPE_LABEL } from "@/lib/i18n/labels";
import { getAnalysisContext } from "@/lib/services/analysis";
import { listCases } from "@/lib/services/cases";
import { formatDateTime, formatNumber } from "@/lib/utils/format";

export async function generateMetadata({ params }: PageProps<"/posts/[id]">): Promise<Metadata> {
  const { id } = await params;
  return { title: `Postingan ${id}` };
}

export default async function PostDetailPage({ params, searchParams }: PageProps<"/posts/[id]">) {
  const user = await verifySession();
  const { id } = await params;
  const sp = await searchParams;
  const ctx = await getAnalysisContext();
  const post = ctx.postById.get(id);
  if (!post) notFound();

  const analysis = ctx.postAnalysis.get(id)!;
  const author = ctx.accountById.get(post.authorId);
  const issue = post.issueId ? ctx.issues.find((i) => i.id === post.issueId) : undefined;
  const claim = post.claimId ? ctx.claims.find((c) => c.id === post.claimId) : undefined;
  const comments = ctx.comments.filter((c) => c.postId === id);
  const openCases = listCases().filter((c) => c.status !== "CLOSED" && !c.postIds.includes(id));

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Postingan ${post.id}`}
        description="Konten yang diamati, analisis otomatis, dan bukti di balik setiap indikator."
        mock={post.provenance.isMock}
        actions={<div className="flex items-center gap-2"><RiskBadge score={analysis.risk.score} /><StatusBadge status={post.status} /></div>}
      />
      <Flash searchParams={sp} />

      <Card title="Konten" description="Data hasil pengamatan">
        <KeyValue
          items={[
            { label: "Platform", value: <PlatformBadge platform={post.platform} /> },
            { label: "URL", value: <span className="break-all">{post.url}</span> },
            { label: "Penulis", value: author ? <Link href={`/accounts/${author.id}`} className="text-sky-400 hover:underline">{author.handle}</Link> : post.authorId },
            { label: "Waktu", value: formatDateTime(post.createdAt) },
            { label: "Jenis media", value: MEDIA_TYPE_LABEL[post.mediaType] },
            { label: "Tagar", value: post.hashtags.join(" ") || "—" },
            { label: "Sebutan", value: post.mentions.join(" ") || "—" },
            { label: "Isu", value: issue ? <Link href={`/monitoring?issue=${issue.id}`} className="text-sky-400 hover:underline">{issue.title}</Link> : "—" },
            { label: "Asal data", value: `${post.provenance.source} · ${post.provenance.collectionMethod === "simulated" ? "simulasi" : post.provenance.collectionMethod === "official_api" ? "API resmi" : "impor manual"} · ${formatDateTime(post.provenance.collectedAt)}` },
          ]}
        />
        <blockquote className="mt-4 rounded-lg border-l-2 border-sky-500/60 bg-slate-950/50 p-3 text-sm text-slate-200">{post.text}</blockquote>
      </Card>

      <section aria-label="Interaksi" className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {([["Suka", post.likes], ["Komentar", post.comments], ["Bagikan", post.shares], ["Tayangan", post.views]] as const).map(([label, v]) => (
          <div key={label} className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
            <p className="text-xs uppercase tracking-wider text-slate-500">{label}</p>
            <p className="mt-1 text-xl font-semibold tabular-nums text-slate-50">{formatNumber(v)}</p>
          </div>
        ))}
      </section>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="min-w-0 lg:col-span-2"><AnalysisCard analysis={analysis.content} /></div>
        <div className="min-w-0 space-y-4">
          <RiskBreakdown risk={analysis.risk} />
          {analysis.coordinationGroupSize >= 3 ? (
            <Notice tone="warning">
              Teks hampir identik diposting oleh {analysis.coordinationGroupSize} akun dalam 48 jam. Ini indikator koordinasi, bukan bukti adanya koordinasi.
            </Notice>
          ) : null}
        </div>
      </div>

      <Card title="Pencocokan kebijakan" description="Potensi kecocokan dengan aturan platform; setiap kecocokan perlu tinjauan manusia">
        {analysis.policyMatches.length ? (
          <div className="grid gap-3 md:grid-cols-2">
            {analysis.policyMatches.map((m) => <PolicyCard key={m.ruleId} match={m} />)}
          </div>
        ) : (
          <p className="text-sm text-slate-500">Tidak ada potensi kecocokan kebijakan yang disarankan untuk postingan ini.</p>
        )}
      </Card>

      {claim ? (
        <Card title="Penilaian klaim" description="Ekstraksi klaim → sumber → pembanding → bukti → penilaian (tidak pernah hanya oleh AI)">
          <p className="text-sm text-slate-200">{claim.text}</p>
          {claim.assessment ? (
            <div className="mt-3 space-y-2 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={claim.assessment.verdict === "likely_false" ? "danger" : claim.assessment.verdict === "verified" || claim.assessment.verdict === "likely_accurate" ? "success" : "warning"}>
                  {CLAIM_VERDICT_LABEL[claim.assessment.verdict].toUpperCase()}
                </Badge>
                <ConfidenceMeter value={claim.assessment.confidence} />
                <span className="text-xs text-slate-500">Dinilai {formatDateTime(claim.assessment.assessedAt)} · peninjau {claim.assessment.reviewer ? userName(claim.assessment.reviewer) : "menunggu"}</span>
              </div>
              <ul className="list-disc pl-5 text-slate-300">{claim.assessment.evidence.map((e) => <li key={e}>{e}</li>)}</ul>
            </div>
          ) : (
            <p className="mt-2 text-sm text-slate-500">Belum dinilai.</p>
          )}
        </Card>
      ) : null}

      <Card title={`Komentar (${comments.length} sampel)`}>
        <DataTable
          caption="Komentar pada postingan ini"
          rows={comments}
          rowKey={(c) => c.id}
          empty="Tidak ada komentar yang dikumpulkan untuk postingan ini."
          columns={[
            { header: "Komentar", className: "max-w-md whitespace-normal", cell: (c) => c.text },
            { header: "Penulis", cell: (c) => ctx.accountById.get(c.authorId)?.handle ?? c.authorId },
            { header: "Sentimen", cell: (c) => <SentimentBadge sentiment={ctx.commentAnalysis.get(c.id)!.sentiment} /> },
            { header: "Kategori", cell: (c) => ctx.commentAnalysis.get(c.id)!.category },
            { header: "Keyakinan", cell: (c) => <ConfidenceMeter value={ctx.commentAnalysis.get(c.id)!.confidence} /> },
            { header: "Waktu", className: "whitespace-nowrap", cell: (c) => formatDateTime(c.createdAt) },
          ]}
        />
      </Card>

      {can(user.role, "case:update") ? (
        <Card title="Tambahkan ke kasus" description="Lampirkan postingan ini ke kasus terbuka untuk ditinjau dan diambil buktinya">
          {openCases.length ? (
            <form action={updateCaseAction} className="flex flex-wrap items-end gap-3">
              <input type="hidden" name="addPostId" value={post.id} />
              <input type="hidden" name="returnTo" value={`/posts/${post.id}`} />
              <div>
                <label htmlFor="caseId" className="mb-1 block text-xs text-slate-400">Kasus</label>
                <select id="caseId" name="caseId" required className="rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-sm text-slate-100">
                  {openCases.map((c) => <option key={c.id} value={c.id}>{c.id}: {c.title.slice(0, 60)}</option>)}
                </select>
              </div>
              <button type="submit" className="rounded-lg bg-sky-500 px-4 py-1.5 text-sm font-semibold text-slate-950 hover:bg-sky-400">Tambahkan ke kasus</button>
              <Link href={`/cases/new?post=${post.id}`} className="text-sm text-sky-400 hover:underline">atau mulai kasus baru</Link>
            </form>
          ) : (
            <p className="text-sm text-slate-500">
              Belum ada kasus terbuka. <Link href={`/cases/new?post=${post.id}`} className="text-sky-400 hover:underline">Mulai kasus baru</Link>.
            </p>
          )}
        </Card>
      ) : null}
    </div>
  );
}
