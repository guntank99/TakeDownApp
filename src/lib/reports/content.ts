import { CASE_STATUS_LABEL, POLICY_CATEGORY_LABEL, PRIORITY_LABEL, RISK_LABEL, SENTIMENT_LABEL } from "@/lib/i18n/labels";
import type { AnalysisContext } from "@/lib/services/analysis";
import { evidenceIntegrity } from "@/lib/services/evidence";
import { PLATFORM_LABEL } from "@/lib/utils/platforms";
import { formatDate, formatDateTime, formatNumber, truncate } from "@/lib/utils/format";
import type { CaseRecord, EvidenceRecord, ReportSection, Sentiment } from "@/types";

const pct = (n: number) => `${Math.round(n * 100)}%`;

/**
 * Builds the frozen analytical sections of a report from the case and the
 * analysis at the moment of creation. Reviewer notes and the recommended next
 * action are separate, editable fields on the report.
 */
export function buildReportSections(
  c: CaseRecord,
  ctx: AnalysisContext,
  evidence: EvidenceRecord[],
): ReportSection[] {
  const posts = c.postIds.map((id) => ctx.postById.get(id)).filter((p) => p !== undefined);
  const accounts = c.accountIds.map((id) => ctx.accountById.get(id)).filter((a) => a !== undefined);
  const analyses = posts.map((p) => ctx.postAnalysis.get(p.id)!);
  const top = analyses.reduce((m, a) => (a.risk.score > (m?.risk.score ?? -1) ? a : m), analyses[0]);

  const summary: ReportSection = {
    title: "Ringkasan Eksekutif",
    body: [
      `${c.id} — ${c.title}`,
      `Platform: ${PLATFORM_LABEL[c.platform]} · Kategori: ${POLICY_CATEGORY_LABEL[c.category]} · Prioritas: ${PRIORITY_LABEL[c.priority]} · Status kasus: ${CASE_STATUS_LABEL[c.status]}`,
      ...(ctx.source.isMock ? ["SUMBER DATA: MOCK / SIMULASI (data prototipe, bukan konten sebenarnya)"] : [`Sumber data: ${ctx.source.label}`]),
      `${posts.length} postingan, ${accounts.length} akun, dan ${evidence.length} butir bukti ditinjau.`,
      top ? `Indikator risiko postingan tertinggi: ${top.risk.score} (${RISK_LABEL[top.risk.level]}).` : "Belum ada postingan yang dilampirkan.",
      "Indikator otomatis adalah alat bantu analisis yang memerlukan tinjauan manusia. Indikator ini bukan temuan bahwa telah terjadi pelanggaran.",
    ],
  };

  const issueIds = [...new Set(posts.map((p) => p.issueId).filter((x): x is string => Boolean(x)))];
  const issueSection: ReportSection = {
    title: "Gambaran Isu",
    body: issueIds.length
      ? issueIds.map((id) => {
          const i = ctx.issues.find((x) => x.id === id);
          return i ? `${i.title} (${i.hashtag}): volume ${formatNumber(i.volume)}, pertumbuhan ${i.growth}%, pertama terdeteksi ${formatDate(i.firstDetectedAt)}, status ${i.status}` : id;
        })
      : ["Tidak ada isu terkait yang terhubung dengan postingan ini."],
  };

  const contentSection: ReportSection = {
    title: "Detail Konten",
    body: posts.slice(0, 15).flatMap((p) => [
      `${p.id} · ${PLATFORM_LABEL[p.platform]} · ${ctx.accountById.get(p.authorId)?.handle ?? p.authorId} · ${formatDateTime(p.createdAt)}`,
      `URL: ${p.url}`,
      `Teks: ${truncate(p.text, 300)}`,
      `Interaksi: ${formatNumber(p.likes)} suka, ${formatNumber(p.comments)} komentar, ${formatNumber(p.shares)} bagikan, ${formatNumber(p.views)} tayangan`,
    ]),
  };

  const accountSection: ReportSection = {
    title: "Analisis Akun",
    body: accounts.flatMap((a) => {
      const an = ctx.accountAnalysis.get(a.id)!;
      const flagged = an.signals.filter((s) => s.flagged).map((s) => s.label);
      return [
        `${a.handle} (${PLATFORM_LABEL[a.platform]}): ${an.authenticityLabel}, skor kekhawatiran ${an.authenticityConcern}/100; risiko ${an.risk.score} (${RISK_LABEL[an.risk.level]})`,
        `Pengikut ${formatNumber(a.followers)}, mengikuti ${formatNumber(a.following)}, dibuat ${formatDate(a.createdAt)}. Sinyal yang ditandai: ${flagged.length ? flagged.join(", ") : "tidak ada"}.`,
      ];
    }),
  };

  const counts: Record<Sentiment, number> = { positive: 0, neutral: 0, negative: 0 };
  for (const a of analyses) counts[a.content.sentiment.sentiment]++;
  const cc: Record<Sentiment, number> = { positive: 0, neutral: 0, negative: 0 };
  const postIdSet = new Set(c.postIds);
  for (const cm of ctx.comments) if (postIdSet.has(cm.postId)) cc[ctx.commentAnalysis.get(cm.id)!.sentiment]++;
  const sentimentSection: ReportSection = {
    title: "Analisis Sentimen",
    body: [
      `Postingan: ${SENTIMENT_LABEL.positive.toLowerCase()} ${counts.positive}, ${SENTIMENT_LABEL.neutral.toLowerCase()} ${counts.neutral}, ${SENTIMENT_LABEL.negative.toLowerCase()} ${counts.negative}.`,
      `Komentar pada postingan ini: ${SENTIMENT_LABEL.positive.toLowerCase()} ${cc.positive}, ${SENTIMENT_LABEL.neutral.toLowerCase()} ${cc.neutral}, ${SENTIMENT_LABEL.negative.toLowerCase()} ${cc.negative}.`,
      "Sentimen berasal dari penganalisis berbasis kata kunci dan dapat keliru membaca sarkasme serta konteks.",
    ],
  };

  const clusterByIndex = new Map(ctx.network.clusters.map((cl) => [cl.index, cl]));
  const snaSection: ReportSection = {
    title: "Temuan SNA",
    body: [
      ...accounts.map((a) => {
        const m = ctx.network.metrics[a.id];
        const cl = m ? clusterByIndex.get(m.community) : undefined;
        const role = ctx.network.roles[a.id];
        return `${a.handle}: ${cl ? cl.name : "tanpa klaster"}, derajat ${m?.degree ?? 0}, betweenness ${(m?.betweenness ?? 0).toFixed(3)}${role ? `, ${role}` : ""}`;
      }),
      "Koneksi mencerminkan data yang tersedia dan tidak dengan sendirinya menunjukkan niat, koordinasi, atau kendali.",
    ],
  };

  const grouped = new Map<string, { rule: string; platform: string; category: string; confidence: number; count: number; verified: boolean; url: string }>();
  for (const a of analyses) {
    for (const m of a.policyMatches) {
      const g = grouped.get(m.ruleId);
      if (g) {
        g.count++;
        g.confidence = Math.max(g.confidence, m.confidence);
      } else grouped.set(m.ruleId, { rule: m.rule, platform: PLATFORM_LABEL[m.platform], category: POLICY_CATEGORY_LABEL[m.category], confidence: m.confidence, count: 1, verified: m.ruleVerified, url: m.officialUrl });
    }
  }
  const policySection: ReportSection = {
    title: "Analisis Kebijakan",
    body: grouped.size
      ? [
          ...[...grouped.values()].sort((a, b) => b.confidence - a.confidence).map(
            (g) => `Potensi kecocokan: ${g.platform}, ${g.rule} (${g.category}), keyakinan ${pct(g.confidence)}, ${g.count} postingan${g.verified ? "" : " [teks aturan BELUM diverifikasi terhadap sumber resmi]"}. ${g.url}`,
          ),
          "Status: PERLU DITINJAU. Pastikan bunyi kebijakan yang tepat di URL resmi sebelum melapor.",
        ]
      : ["Analisis otomatis tidak menyarankan kecocokan kebijakan."],
  };

  const evidenceSection: ReportSection = {
    title: "Bukti",
    body: evidence.length
      ? evidence.map((e) => `${e.id}: ${e.postId ?? e.url}, diambil ${formatDateTime(e.capturedAt)} oleh ${e.collectedBy}; SHA-256 ${e.hash}; integritas ${evidenceIntegrity(e) ? "SESUAI" : "TIDAK SESUAI"}`)
      : ["Belum ada bukti yang diambil untuk kasus ini."],
  };

  const riskSection: ReportSection = {
    title: "Penilaian Risiko",
    body: [
      ...analyses.map((a) => `${a.postId}: ${a.risk.score} (${RISK_LABEL[a.risk.level]}); konten ${a.risk.components.content}, perilaku ${a.risk.components.behavior}, jaringan ${a.risk.components.network}, koordinasi ${a.risk.components.coordination}`),
      "Skor risiko adalah indikator analitis untuk menentukan prioritas tinjauan, bukan keputusan.",
    ],
  };

  return [summary, issueSection, contentSection, accountSection, sentimentSection, snaSection, policySection, evidenceSection, riskSection];
}
