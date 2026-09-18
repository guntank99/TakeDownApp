import type { ContentAnalysis, IndicatorKey, RiskAssessment, RiskComponents } from "@/types";
import { getRiskLevel } from "./level";

/**
 * Explainable risk model. Total = content + behavior + network + coordination,
 * each capped at its own maximum so the four maxima add up to 100.
 * The score is an ANALYTICAL INDICATOR for prioritising human review, never
 * a final decision.
 */
export const RISK_MAX: RiskComponents = {
  content: 40,
  behavior: 25,
  network: 20,
  coordination: 15,
};

const INDICATOR_WEIGHT: Record<IndicatorKey, number> = {
  threat: 1,
  hate_speech: 1,
  harassment: 0.65,
  defamation: 0.6,
  impersonation: 0.6,
  misinformation: 0.55,
  spam: 0.35,
};

/** Content-risk points (0–40) for one analysed text. */
export function contentRiskPoints(a: ContentAnalysis): number {
  let base = 0;
  for (const key of a.flagged) base += INDICATOR_WEIGHT[key] * a.indicators[key].confidence;
  const total = Math.min(1, base + 0.25 * (a.toxicity / 100));
  return Math.round(RISK_MAX.content * total);
}

const clampTo = (n: number, max: number) => Math.round(Math.min(max, Math.max(0, n)));

export function calculateRisk(
  components: Partial<RiskComponents>,
  factors: string[] = [],
): RiskAssessment {
  const c: RiskComponents = {
    content: clampTo(components.content ?? 0, RISK_MAX.content),
    behavior: clampTo(components.behavior ?? 0, RISK_MAX.behavior),
    network: clampTo(components.network ?? 0, RISK_MAX.network),
    coordination: clampTo(components.coordination ?? 0, RISK_MAX.coordination),
  };
  const score = c.content + c.behavior + c.network + c.coordination;
  const active = Object.values(c).filter((v) => v > 0).length;
  return {
    score,
    level: getRiskLevel(score),
    components: c,
    factors,
    // More independent signals agreeing → higher (never certain) confidence.
    confidence: Math.round(Math.min(0.9, 0.45 + 0.1 * active) * 100) / 100,
  };
}
