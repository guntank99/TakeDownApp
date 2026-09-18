import type { Metadata } from "next";
import Link from "next/link";
import { Badge, ConfidenceMeter } from "@/components/ui/badges";
import { Card, PageHeader } from "@/components/ui/layout";
import { userName } from "@/lib/auth/directory";
import { CLAIM_VERDICT_LABEL } from "@/lib/i18n/labels";
import { verifySession } from "@/lib/auth/dal";
import { getAnalysisContext } from "@/lib/services/analysis";
import { formatDateTime } from "@/lib/utils/format";
import type { ClaimVerdict } from "@/types";

export const metadata: Metadata = { title: "Misinformasi" };

const VERDICT: Record<ClaimVerdict, { label: string; tone: "success" | "info" | "warning" | "danger" }> = {
  verified: { label: CLAIM_VERDICT_LABEL.verified, tone: "success" },
  likely_accurate: { label: CLAIM_VERDICT_LABEL.likely_accurate, tone: "success" },
  unverified: { label: CLAIM_VERDICT_LABEL.unverified, tone: "warning" },
  disputed: { label: CLAIM_VERDICT_LABEL.disputed, tone: "warning" },
  likely_false: { label: CLAIM_VERDICT_LABEL.likely_false, tone: "danger" },
};

const STEPS = ["Ekstraksi klaim", "Identifikasi sumber", "Keandalan sumber", "Pembandingan lintas sumber", "Bukti", "Penilaian"];

export default async function ClaimsPage() {
  await verifySession();
  const ctx = await getAnalysisContext();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Misinformasi & disinformasi"
        description="Model AI tidak pernah menjadi satu-satunya dasar sebuah putusan. Setiap penilaian membutuhkan bukti, sumber, waktu, keyakinan, dan peninjau."
        mock={ctx.source.isMock}
      />
      <ol className="flex flex-wrap gap-2 text-xs text-slate-400" aria-label="Alur penilaian">
        {STEPS.map((s, i) => (
          <li key={s} className="rounded-full border border-slate-800 px-3 py-1">{i + 1}. {s}</li>
        ))}
      </ol>

      {ctx.claims.length === 0 ? (
        <p className="text-sm text-slate-500">Belum ada klaim yang diekstrak dari sumber data ini.</p>
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
                action={a ? <Badge tone={VERDICT[a.verdict].tone}>{VERDICT[a.verdict].label.toUpperCase()}</Badge> : <Badge>BELUM DINILAI</Badge>}
              >
                <p className="text-xs text-slate-500">
                  Diambil dari <Link href={`/posts/${claim.extractedFromPostId}`} className="text-sky-400 hover:underline">{claim.extractedFromPostId}</Link>
                  {" · "}diulang pada {spread.length} postingan
                  {" · "}<span className="text-amber-300">penilaian bukan temuan hukum</span>
                </p>
                {a ? (
                  <div className="mt-3 space-y-3 text-sm">
                    <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400">
                      <ConfidenceMeter value={a.confidence} />
                      <span>Dinilai {formatDateTime(a.assessedAt)}</span>
                      <span>Peninjau: {a.reviewer ? userName(a.reviewer) : <em>menunggu</em>}</span>
                    </div>
                    <div>
                      <p className="mb-1 text-xs uppercase tracking-wider text-slate-500">Bukti</p>
                      <ul className="list-disc space-y-0.5 pl-5 text-slate-300">{a.evidence.map((e) => <li key={e}>{e}</li>)}</ul>
                    </div>
                    <div>
                      <p className="mb-1 text-xs uppercase tracking-wider text-slate-500">Sumber</p>
                      <ul className="space-y-0.5">
                        {a.sources.map((s) => (
                          <li key={s.url} className="text-slate-300">{s.name} <span className="text-xs text-slate-500">· keandalan: {s.reliability} · {s.url}</span></li>
                        ))}
                      </ul>
                    </div>
                  </div>
                ) : (
                  <p className="mt-3 text-sm text-slate-500">Menunggu peninjau mengumpulkan sumber dan menilai.</p>
                )}
              </Card>
            );
          })}
        </div>
      )}
      <p className="text-xs text-slate-500">Sumber pada dataset mock memakai domain fiktif .example.</p>
    </div>
  );
}
