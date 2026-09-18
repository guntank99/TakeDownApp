import type { AnalysisContext } from "@/lib/services/analysis";
import { evidenceIntegrity } from "@/lib/services/evidence";
import { PLATFORM_LABEL } from "@/lib/utils/platforms";
import { formatDate, formatDateTime, truncate } from "@/lib/utils/format";
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
    title: "Executive Summary",
    body: [
      `${c.id} — ${c.title}`,
      `Platform: ${PLATFORM_LABEL[c.platform]} · Category: ${c.category} · Priority: ${c.priority} · Case status: ${c.status}`,
      ...(ctx.source.isMock ? ["DATA SOURCE: MOCK / SIMULATED (prototype data, not live content)"] : [`Data source: ${ctx.source.label}`]),
      `${posts.length} post(s), ${accounts.length} account(s) and ${evidence.length} evidence item(s) reviewed.`,
      top ? `Highest post risk indicator: ${top.risk.score} (${top.risk.level.toUpperCase()}).` : "No posts attached.",
      "Automated indicators are analytical aids that require human review. They are not findings that a violation occurred.",
    ],
  };

  const issueIds = [...new Set(posts.map((p) => p.issueId).filter((x): x is string => Boolean(x)))];
  const issueSection: ReportSection = {
    title: "Issue Overview",
    body: issueIds.length
      ? issueIds.map((id) => {
          const i = ctx.issues.find((x) => x.id === id);
          return i ? `${i.title} (${i.hashtag}) — volume ${i.volume.toLocaleString("en-US")}, growth ${i.growth}%, first detected ${formatDate(i.firstDetectedAt)}, status ${i.status}` : id;
        })
      : ["No related issue is linked to these posts."],
  };

  const contentSection: ReportSection = {
    title: "Content Details",
    body: posts.slice(0, 15).flatMap((p) => [
      `${p.id} · ${PLATFORM_LABEL[p.platform]} · ${ctx.accountById.get(p.authorId)?.handle ?? p.authorId} · ${formatDateTime(p.createdAt)}`,
      `URL: ${p.url}`,
      `Text: ${truncate(p.text, 300)}`,
      `Engagement: ${p.likes} likes, ${p.comments} comments, ${p.shares} shares, ${p.views} views`,
    ]),
  };

  const accountSection: ReportSection = {
    title: "Account Analysis",
    body: accounts.flatMap((a) => {
      const an = ctx.accountAnalysis.get(a.id)!;
      const flagged = an.signals.filter((s) => s.flagged).map((s) => s.label);
      return [
        `${a.handle} (${PLATFORM_LABEL[a.platform]}) — ${an.authenticityLabel}, concern ${an.authenticityConcern}/100; risk ${an.risk.score} (${an.risk.level.toUpperCase()})`,
        `Followers ${a.followers}, following ${a.following}, created ${formatDate(a.createdAt)}. Flagged signals: ${flagged.length ? flagged.join(", ") : "none"}.`,
      ];
    }),
  };

  const counts: Record<Sentiment, number> = { positive: 0, neutral: 0, negative: 0 };
  for (const a of analyses) counts[a.content.sentiment.sentiment]++;
  const cc: Record<Sentiment, number> = { positive: 0, neutral: 0, negative: 0 };
  const postIdSet = new Set(c.postIds);
  for (const cm of ctx.comments) if (postIdSet.has(cm.postId)) cc[ctx.commentAnalysis.get(cm.id)!.sentiment]++;
  const sentimentSection: ReportSection = {
    title: "Sentiment Analysis",
    body: [
      `Posts — positive ${counts.positive}, neutral ${counts.neutral}, negative ${counts.negative}.`,
      `Comments on these posts — positive ${cc.positive}, neutral ${cc.neutral}, negative ${cc.negative}.`,
      "Sentiment comes from a keyword-based analyzer and may misread sarcasm and context.",
    ],
  };

  const clusterByIndex = new Map(ctx.network.clusters.map((cl) => [cl.index, cl]));
  const snaSection: ReportSection = {
    title: "SNA Findings",
    body: [
      ...accounts.map((a) => {
        const m = ctx.network.metrics[a.id];
        const cl = m ? clusterByIndex.get(m.community) : undefined;
        const role = ctx.network.roles[a.id];
        return `${a.handle}: ${cl ? cl.name : "no cluster"}, degree ${m?.degree ?? 0}, betweenness ${(m?.betweenness ?? 0).toFixed(3)}${role ? `, ${role}` : ""}`;
      }),
      "Connections reflect the data available and do not by themselves show intent, coordination or control.",
    ],
  };

  const grouped = new Map<string, { rule: string; platform: string; category: string; confidence: number; count: number; verified: boolean; url: string }>();
  for (const a of analyses) {
    for (const m of a.policyMatches) {
      const g = grouped.get(m.ruleId);
      if (g) {
        g.count++;
        g.confidence = Math.max(g.confidence, m.confidence);
      } else grouped.set(m.ruleId, { rule: m.rule, platform: PLATFORM_LABEL[m.platform], category: m.category, confidence: m.confidence, count: 1, verified: m.ruleVerified, url: m.officialUrl });
    }
  }
  const policySection: ReportSection = {
    title: "Policy Analysis",
    body: grouped.size
      ? [
          ...[...grouped.values()].sort((a, b) => b.confidence - a.confidence).map(
            (g) => `Potential match: ${g.platform} — ${g.rule} (${g.category}), confidence ${pct(g.confidence)}, ${g.count} post(s)${g.verified ? "" : " [rule text NOT yet verified against the official source]"} — ${g.url}`,
          ),
          "Status: NEEDS REVIEW. Confirm the exact policy wording at the official URL before reporting.",
        ]
      : ["No potential policy matches were suggested by the automated analysis."],
  };

  const evidenceSection: ReportSection = {
    title: "Evidence",
    body: evidence.length
      ? evidence.map((e) => `${e.id} — ${e.postId ?? e.url}, captured ${formatDateTime(e.capturedAt)} by ${e.collectedBy}; SHA-256 ${e.hash}; integrity ${evidenceIntegrity(e) ? "OK" : "MISMATCH"}`)
      : ["No evidence has been captured for this case yet."],
  };

  const riskSection: ReportSection = {
    title: "Risk Assessment",
    body: [
      ...analyses.map((a) => `${a.postId}: ${a.risk.score} (${a.risk.level.toUpperCase()}) — content ${a.risk.components.content}, behavior ${a.risk.components.behavior}, network ${a.risk.components.network}, coordination ${a.risk.components.coordination}`),
      "Risk scores are analytical indicators for prioritising review, not decisions.",
    ],
  };

  return [summary, issueSection, contentSection, accountSection, sentimentSection, snaSection, policySection, evidenceSection, riskSection];
}
