import type { Metadata } from "next";
import Link from "next/link";
import { Badge, ConfidenceMeter } from "@/components/ui/badges";
import { Card, PageHeader } from "@/components/ui/layout";
import { userName } from "@/lib/auth/directory";
import { verifySession } from "@/lib/auth/dal";
import { getAnalysisContext } from "@/lib/services/analysis";
import { formatDateTime } from "@/lib/utils/format";
import type { ClaimVerdict } from "@/types";

export const metadata: Metadata = { title: "Misinformation" };

const VERDICT: Record<ClaimVerdict, { label: string; tone: "success" | "info" | "warning" | "danger" }> = {
  verified: { label: "Verified", tone: "success" },
  likely_accurate: { label: "Likely Accurate", tone: "success" },
  unverified: { label: "Unverified", tone: "warning" },
  disputed: { label: "Disputed", tone: "warning" },
  likely_false: { label: "Likely False", tone: "danger" },
};

const STEPS = ["Claim extraction", "Source identification", "Source reliability", "Cross-source comparison", "Evidence", "Assessment"];

export default async function ClaimsPage() {
  await verifySession();
  const ctx = await getAnalysisContext();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Misinformation & disinformation"
        description="An AI model is never the only basis for a verdict. Each assessment needs evidence, sources, a timestamp, a confidence and a reviewer."
        mock={ctx.source.isMock}
      />
      <ol className="flex flex-wrap gap-2 text-xs text-slate-400" aria-label="Assessment workflow">
        {STEPS.map((s, i) => (
          <li key={s} className="rounded-full border border-slate-800 px-3 py-1">{i + 1}. {s}</li>
        ))}
      </ol>

      {ctx.claims.length === 0 ? (
        <p className="text-sm text-slate-500">No claims have been extracted for this data source.</p>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {ctx.claims.map((claim) => {
            const a = claim.assessment;
            const post = ctx.postById.get(claim.extractedFromPostId);
            const spread = post?.claimId ? ctx.posts.filter((p) => p.claimId === claim.id) : [];
            return (
              <Card
                key={claim.id}
                title={`${claim.id}: ${claim.text}`}
                action={a ? <Badge tone={VERDICT[a.verdict].tone}>{VERDICT[a.verdict].label.toUpperCase()}</Badge> : <Badge>NOT ASSESSED</Badge>}
              >
                <p className="text-xs text-slate-500">
                  Extracted from <Link href={`/posts/${claim.extractedFromPostId}`} className="text-sky-400 hover:underline">{claim.extractedFromPostId}</Link>
                  {" · "}repeated in {spread.length} post(s)
                  {" · "}<span className="text-amber-300">an assessment is not a legal finding</span>
                </p>
                {a ? (
                  <div className="mt-3 space-y-3 text-sm">
                    <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400">
                      <ConfidenceMeter value={a.confidence} />
                      <span>Assessed {formatDateTime(a.assessedAt)}</span>
                      <span>Reviewer: {a.reviewer ? userName(a.reviewer) : <em>pending</em>}</span>
                    </div>
                    <div>
                      <p className="mb-1 text-xs uppercase tracking-wider text-slate-500">Evidence</p>
                      <ul className="list-disc space-y-0.5 pl-5 text-slate-300">{a.evidence.map((e) => <li key={e}>{e}</li>)}</ul>
                    </div>
                    <div>
                      <p className="mb-1 text-xs uppercase tracking-wider text-slate-500">Sources</p>
                      <ul className="space-y-0.5">
                        {a.sources.map((s) => (
                          <li key={s.url} className="text-slate-300">{s.name} <span className="text-xs text-slate-500">· reliability: {s.reliability} · {s.url}</span></li>
                        ))}
                      </ul>
                    </div>
                  </div>
                ) : (
                  <p className="mt-3 text-sm text-slate-500">Waiting for a reviewer to gather sources and assess.</p>
                )}
              </Card>
            );
          })}
        </div>
      )}
      <p className="text-xs text-slate-500">Sources shown for the mock dataset use fictional .example domains.</p>
    </div>
  );
}
