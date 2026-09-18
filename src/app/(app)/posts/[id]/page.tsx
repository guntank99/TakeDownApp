import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { updateCaseAction } from "@/app/(app)/actions";
import { AnalysisCard, PolicyCard, RiskBreakdown } from "@/components/analysis/AnalysisCard";
import { DataTable } from "@/components/tables/DataTable";
import { Badge, ConfidenceMeter, PlatformBadge, RiskBadge, SentimentBadge, StatusBadge } from "@/components/ui/badges";
import { Card, Flash, KeyValue, Notice, PageHeader } from "@/components/ui/layout";
import { verifySession } from "@/lib/auth/dal";
import { can } from "@/lib/auth/permissions";
import { getAnalysisContext } from "@/lib/services/analysis";
import { listCases } from "@/lib/services/cases";
import { formatDateTime, formatNumber } from "@/lib/utils/format";

export async function generateMetadata({ params }: PageProps<"/posts/[id]">): Promise<Metadata> {
  const { id } = await params;
  return { title: `Post ${id}` };
}

const VERDICT_LABEL = {
  verified: "Verified", likely_accurate: "Likely Accurate", unverified: "Unverified", disputed: "Disputed", likely_false: "Likely False",
} as const;

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
        title={`Post ${post.id}`}
        description="Observed content, automated analysis and the evidence behind each indicator."
        mock={post.provenance.isMock}
        actions={<div className="flex items-center gap-2"><RiskBadge score={analysis.risk.score} /><StatusBadge status={post.status} /></div>}
      />
      <Flash searchParams={sp} />

      <Card title="Content" description="Observed data">
        <KeyValue
          items={[
            { label: "Platform", value: <PlatformBadge platform={post.platform} /> },
            { label: "URL", value: <span className="break-all">{post.url}</span> },
            { label: "Author", value: author ? <Link href={`/accounts/${author.id}`} className="text-sky-400 hover:underline">{author.handle}</Link> : post.authorId },
            { label: "Timestamp", value: formatDateTime(post.createdAt) },
            { label: "Media type", value: post.mediaType },
            { label: "Hashtags", value: post.hashtags.join(" ") || "—" },
            { label: "Mentions", value: post.mentions.join(" ") || "—" },
            { label: "Issue", value: issue ? <Link href={`/monitoring?issue=${issue.id}`} className="text-sky-400 hover:underline">{issue.title}</Link> : "—" },
            { label: "Provenance", value: `${post.provenance.source} · ${post.provenance.collectionMethod} · ${formatDateTime(post.provenance.collectedAt)}` },
          ]}
        />
        <blockquote className="mt-4 rounded-lg border-l-2 border-sky-500/60 bg-slate-950/50 p-3 text-sm text-slate-200">{post.text}</blockquote>
      </Card>

      <section aria-label="Engagement" className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {([["Likes", post.likes], ["Comments", post.comments], ["Shares", post.shares], ["Views", post.views]] as const).map(([label, v]) => (
          <div key={label} className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
            <p className="text-xs uppercase tracking-wider text-slate-500">{label}</p>
            <p className="mt-1 text-xl font-semibold tabular-nums text-slate-50">{formatNumber(v)}</p>
          </div>
        ))}
      </section>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2"><AnalysisCard analysis={analysis.content} /></div>
        <div className="space-y-4">
          <RiskBreakdown risk={analysis.risk} />
          {analysis.coordinationGroupSize >= 3 ? (
            <Notice tone="warning">
              Near-identical text was posted by {analysis.coordinationGroupSize} accounts within 48 hours. This is a coordination indicator, not proof of coordination.
            </Notice>
          ) : null}
        </div>
      </div>

      <Card title="Policy matching" description="Potential matches to platform rules — every match needs human review">
        {analysis.policyMatches.length ? (
          <div className="grid gap-3 md:grid-cols-2">
            {analysis.policyMatches.map((m) => <PolicyCard key={m.ruleId} match={m} />)}
          </div>
        ) : (
          <p className="text-sm text-slate-500">No potential policy matches were suggested for this post.</p>
        )}
      </Card>

      {claim ? (
        <Card title="Claim assessment" description="Claim extraction → source → cross-check → evidence → assessment (never AI-only)">
          <p className="text-sm text-slate-200">{claim.text}</p>
          {claim.assessment ? (
            <div className="mt-3 space-y-2 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={claim.assessment.verdict === "likely_false" ? "danger" : claim.assessment.verdict === "verified" || claim.assessment.verdict === "likely_accurate" ? "success" : "warning"}>
                  {VERDICT_LABEL[claim.assessment.verdict].toUpperCase()}
                </Badge>
                <ConfidenceMeter value={claim.assessment.confidence} />
                <span className="text-xs text-slate-500">Assessed {formatDateTime(claim.assessment.assessedAt)} · reviewer {claim.assessment.reviewer ?? "pending"}</span>
              </div>
              <ul className="list-disc pl-5 text-slate-300">{claim.assessment.evidence.map((e) => <li key={e}>{e}</li>)}</ul>
            </div>
          ) : (
            <p className="mt-2 text-sm text-slate-500">Not yet assessed.</p>
          )}
        </Card>
      ) : null}

      <Card title={`Comments (${comments.length} sampled)`}>
        <DataTable
          caption="Comments on this post"
          rows={comments}
          rowKey={(c) => c.id}
          empty="No comments were collected for this post."
          columns={[
            { header: "Comment", className: "max-w-md whitespace-normal", cell: (c) => c.text },
            { header: "Author", cell: (c) => ctx.accountById.get(c.authorId)?.handle ?? c.authorId },
            { header: "Sentiment", cell: (c) => <SentimentBadge sentiment={ctx.commentAnalysis.get(c.id)!.sentiment} /> },
            { header: "Category", cell: (c) => ctx.commentAnalysis.get(c.id)!.category },
            { header: "Confidence", cell: (c) => <ConfidenceMeter value={ctx.commentAnalysis.get(c.id)!.confidence} /> },
            { header: "Time", className: "whitespace-nowrap", cell: (c) => formatDateTime(c.createdAt) },
          ]}
        />
      </Card>

      {can(user.role, "case:update") ? (
        <Card title="Add to a case" description="Attach this post to an existing open case for review and evidence capture">
          {openCases.length ? (
            <form action={updateCaseAction} className="flex flex-wrap items-end gap-3">
              <input type="hidden" name="addPostId" value={post.id} />
              <input type="hidden" name="returnTo" value={`/posts/${post.id}`} />
              <div>
                <label htmlFor="caseId" className="mb-1 block text-xs text-slate-400">Case</label>
                <select id="caseId" name="caseId" required className="rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-sm text-slate-100">
                  {openCases.map((c) => <option key={c.id} value={c.id}>{c.id} — {c.title.slice(0, 60)}</option>)}
                </select>
              </div>
              <button type="submit" className="rounded-lg bg-sky-500 px-4 py-1.5 text-sm font-semibold text-slate-950 hover:bg-sky-400">Add to case</button>
              <Link href={`/cases/new?post=${post.id}`} className="text-sm text-sky-400 hover:underline">or start a new case</Link>
            </form>
          ) : (
            <p className="text-sm text-slate-500">
              No open case available. <Link href={`/cases/new?post=${post.id}`} className="text-sky-400 hover:underline">Start a new case</Link>.
            </p>
          )}
        </Card>
      ) : null}
    </div>
  );
}
