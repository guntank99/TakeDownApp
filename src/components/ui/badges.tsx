import {
  CASE_STATUS_LABEL,
  ISSUE_STATUS_LABEL,
  POST_STATUS_LABEL,
  REPORT_STATUS_LABEL,
  REVIEW_STATUS_LABEL,
  RISK_LABEL,
  SENTIMENT_LABEL,
} from "@/lib/i18n/labels";
import { getRiskLevel } from "@/lib/risk/level";
import { PLATFORM_COLOR, PLATFORM_LABEL } from "@/lib/utils/platforms";
import type { Platform, RiskLevel, Sentiment } from "@/types";

type Tone = "neutral" | "info" | "success" | "warning" | "danger" | "critical" | "mock";

const TONE: Record<Tone, string> = {
  neutral: "border-slate-600/60 bg-slate-500/10 text-slate-300",
  info: "border-sky-500/40 bg-sky-500/10 text-sky-300",
  success: "border-emerald-500/40 bg-emerald-500/10 text-emerald-300",
  warning: "border-amber-500/40 bg-amber-500/10 text-amber-300",
  danger: "border-orange-500/40 bg-orange-500/10 text-orange-300",
  critical: "border-red-500/50 bg-red-500/15 text-red-300",
  mock: "border-amber-500/40 bg-amber-500/10 text-amber-300",
};

export function Badge({ tone = "neutral", children, title }: { tone?: Tone; children: React.ReactNode; title?: string }) {
  return (
    <span
      title={title}
      className={`inline-flex items-center gap-1 whitespace-nowrap rounded-md border px-2 py-0.5 text-[11px] font-semibold tracking-wide ${TONE[tone]}`}
    >
      {children}
    </span>
  );
}

const RISK_TONE: Record<RiskLevel, Tone> = { low: "success", medium: "warning", high: "danger", critical: "critical" };

/** Level text is always shown, so colour is never the only signal. */
export function RiskBadge({ score, showScore = true }: { score: number; showScore?: boolean }) {
  const level = getRiskLevel(score);
  return (
    <Badge tone={RISK_TONE[level]} title={`Skor risiko ${score}/100: indikator analitis, bukan keputusan`}>
      {RISK_LABEL[level]}
      {showScore ? <span className="font-normal opacity-80">· {score}</span> : null}
    </Badge>
  );
}

export function RiskLevelBadge({ level }: { level: RiskLevel }) {
  return <Badge tone={RISK_TONE[level]}>{RISK_LABEL[level]}</Badge>;
}

export function PlatformBadge({ platform }: { platform: Platform }) {
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-xs text-slate-300">
      <span className="size-2 rounded-full" style={{ background: PLATFORM_COLOR[platform] }} aria-hidden="true" />
      {PLATFORM_LABEL[platform]}
    </span>
  );
}

const SENTIMENT_TONE: Record<Sentiment, Tone> = { positive: "info", neutral: "neutral", negative: "danger" };

export function SentimentBadge({ sentiment }: { sentiment: Sentiment }) {
  return <Badge tone={SENTIMENT_TONE[sentiment]}>{SENTIMENT_LABEL[sentiment].toUpperCase()}</Badge>;
}

const STATUS_TONE: Record<string, Tone> = {
  // posts
  new: "info", needs_review: "warning", reviewed: "success",
  // issues
  active: "danger", monitoring: "warning", closed: "neutral",
  // cases
  OPEN: "info", INVESTIGATING: "warning", NEEDS_REVIEW: "warning", VERIFIED: "success", REPORTED: "success", CLOSED: "neutral",
  // reports
  draft: "neutral", in_review: "warning", approved: "success", submitted: "success",
  // analysis review status
  NEEDS_HUMAN_REVIEW: "warning", NO_INDICATORS: "neutral",
};

/** Display labels for every status code the app uses (codes stay English in data/API). */
const STATUS_LABEL: Record<string, string> = {
  ...POST_STATUS_LABEL,
  ...ISSUE_STATUS_LABEL,
  ...CASE_STATUS_LABEL,
  ...REPORT_STATUS_LABEL,
  ...REVIEW_STATUS_LABEL,
  // "closed" (issue) and "CLOSED" (case) differ only by case
  closed: ISSUE_STATUS_LABEL.closed,
};

export function StatusBadge({ status }: { status: string }) {
  return <Badge tone={STATUS_TONE[status] ?? "neutral"}>{(STATUS_LABEL[status] ?? status.replace(/_/g, " ")).toUpperCase()}</Badge>;
}

export function ConfidenceMeter({ value }: { value: number }) {
  const pct = Math.round(value * 100);
  return (
    <span className="inline-flex items-center gap-2 text-xs tabular-nums text-slate-300" title={`Keyakinan ${pct}%`}>
      <span className="h-1.5 w-14 overflow-hidden rounded-full bg-slate-800" aria-hidden="true">
        <span className="block h-full rounded-full bg-sky-400" style={{ width: `${pct}%` }} />
      </span>
      {pct}%
    </span>
  );
}
