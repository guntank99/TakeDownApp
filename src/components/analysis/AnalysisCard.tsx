import { Badge, ConfidenceMeter, RiskBadge, SentimentBadge, StatusBadge } from "@/components/ui/badges";
import { Card } from "@/components/ui/layout";
import type { ContentAnalysis, Indicator, PolicyMatch, RiskAssessment } from "@/types";

function IndicatorRow({ ind }: { ind: Indicator }) {
  return (
    <li className="flex flex-col gap-1 border-t border-slate-800/80 py-3 first:border-t-0 first:pt-0">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium text-slate-100">{ind.label}</span>
        {ind.detected ? <Badge tone="warning">DETECTED</Badge> : <Badge>NONE</Badge>}
        {ind.detected ? <ConfidenceMeter value={ind.confidence} /> : null}
      </div>
      <p className="text-xs text-slate-400">{ind.reason}</p>
      {ind.evidence.length > 0 ? (
        <p className="flex flex-wrap gap-1.5 text-xs">
          <span className="text-slate-500">Evidence:</span>
          {ind.evidence.map((e) => (
            <code key={e} className="rounded bg-slate-800 px-1.5 py-0.5 text-slate-300">
              {e}
            </code>
          ))}
        </p>
      ) : null}
    </li>
  );
}

/** Shows an automated content assessment with everything an analyst needs to check it. */
export function AnalysisCard({ analysis, title = "Automated analysis" }: { analysis: ContentAnalysis; title?: string }) {
  const s = analysis.sentiment;
  return (
    <Card title={title} description={`AI/NLP result · source: ${analysis.engine} · reviewer status: not reviewed`}>
      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <div>
          <p className="text-xs uppercase tracking-wider text-slate-500">Sentiment</p>
          <div className="mt-1 flex items-center gap-2">
            <SentimentBadge sentiment={s.sentiment} />
            <ConfidenceMeter value={s.confidence} />
          </div>
          <p className="mt-1 text-xs text-slate-400">{s.reason}</p>
          {s.keywords.length > 0 ? (
            <p className="mt-1 text-xs text-slate-500">Keywords: {s.keywords.join(", ")}</p>
          ) : null}
        </div>
        <div>
          <p className="text-xs uppercase tracking-wider text-slate-500">Toxicity</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-slate-100">{analysis.toxicity}<span className="text-sm text-slate-500"> / 100</span></p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wider text-slate-500">Final status</p>
          <div className="mt-1">
            <StatusBadge status={analysis.status} />
          </div>
          <p className="mt-1 text-xs text-slate-500">Indicators are aids for human review, not findings.</p>
        </div>
      </div>
      <ul>
        {Object.values(analysis.indicators).map((ind) => (
          <IndicatorRow key={ind.key} ind={ind} />
        ))}
      </ul>
    </Card>
  );
}

const MAX = { content: 40, behavior: 25, network: 20, coordination: 15 } as const;

export function RiskBreakdown({ risk, title = "Risk score" }: { risk: RiskAssessment; title?: string }) {
  const rows: [keyof typeof MAX, string][] = [
    ["content", "Content Risk"],
    ["behavior", "Behavior Risk"],
    ["network", "Network Risk"],
    ["coordination", "Coordination Risk"],
  ];
  return (
    <Card title={title} description="Analytical indicator — not a final decision">
      <div className="mb-3 flex items-center gap-3">
        <RiskBadge score={risk.score} />
        <ConfidenceMeter value={risk.confidence} />
      </div>
      <table className="w-full text-sm">
        <caption className="sr-only">Risk score breakdown</caption>
        <tbody>
          {rows.map(([key, label]) => (
            <tr key={key}>
              <th scope="row" className="py-1 pr-3 text-left font-normal text-slate-400">{label}</th>
              <td className="w-full py-1 pr-3">
                <span className="block h-1.5 overflow-hidden rounded-full bg-slate-800" aria-hidden="true">
                  <span className="block h-full rounded-full bg-sky-400" style={{ width: `${(risk.components[key] / MAX[key]) * 100}%` }} />
                </span>
              </td>
              <td className="whitespace-nowrap py-1 text-right tabular-nums text-slate-200">{risk.components[key]} <span className="text-slate-600">/ {MAX[key]}</span></td>
            </tr>
          ))}
          <tr className="border-t border-slate-800">
            <th scope="row" className="pt-2 text-left font-medium text-slate-200">Total</th>
            <td />
            <td className="pt-2 text-right font-semibold tabular-nums text-slate-50">{risk.score}</td>
          </tr>
        </tbody>
      </table>
      {risk.factors.length > 0 ? (
        <ul className="mt-3 list-disc space-y-0.5 pl-5 text-xs text-slate-400">
          {risk.factors.map((f) => (
            <li key={f}>{f}</li>
          ))}
        </ul>
      ) : null}
    </Card>
  );
}

export function PolicyCard({ match }: { match: PolicyMatch }) {
  return (
    <article className="rounded-lg border border-slate-800 bg-slate-950/50 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-sm font-semibold text-slate-100">Potential Policy Violation</h3>
        <StatusBadge status="NEEDS_REVIEW" />
        <ConfidenceMeter value={match.confidence} />
      </div>
      <p className="mt-1 text-sm text-slate-300">
        {match.category} · <span className="text-slate-400">{match.rule}</span>
      </p>
      {!match.ruleVerified ? (
        <p className="mt-1 text-xs text-amber-300">
          Rule text not yet verified against the official source. Read the policy before relying on this match.
        </p>
      ) : null}
      {match.evidence.length > 0 ? (
        <p className="mt-2 text-xs text-slate-500">Evidence: {match.evidence.join(" · ")}</p>
      ) : null}
      <a
        href={match.officialUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-2 inline-block text-xs text-sky-400 hover:underline"
      >
        Official policy ↗
      </a>
    </article>
  );
}
