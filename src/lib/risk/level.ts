import type { RiskLevel } from "@/types";

/**
 * Maps a 0–100 risk score to a level:
 * 0–24 LOW, 25–49 MEDIUM, 50–74 HIGH, 75–100 CRITICAL.
 *
 * A risk score is an analytical indicator, not a final decision.
 */
export function getRiskLevel(score: number): RiskLevel {
  if (score >= 75) return "critical";
  if (score >= 50) return "high";
  if (score >= 25) return "medium";
  return "low";
}

/** HIGH or CRITICAL. */
export function isHighRisk(score: number): boolean {
  return score >= 50;
}
