import type {
  ContentAnalysis,
  IndicatorKey,
  Platform,
  PolicyCategory,
  PolicyMatch,
  PolicyRule,
} from "@/types";

/** Which policy categories each analysis indicator can relate to. */
const CATEGORY_MAP: Record<IndicatorKey, { categories: PolicyCategory[]; factor: number }[]> = {
  hate_speech: [{ categories: ["Hate Speech"], factor: 1 }],
  harassment: [{ categories: ["Harassment"], factor: 1 }],
  threat: [{ categories: ["Threats", "Violence"], factor: 1 }],
  spam: [{ categories: ["Spam"], factor: 1 }],
  misinformation: [{ categories: ["Misinformation"], factor: 1 }],
  // Defamation is not a platform rule category; the closest is harassment. Lower confidence.
  defamation: [{ categories: ["Harassment"], factor: 0.6 }],
  impersonation: [
    { categories: ["Impersonation"], factor: 1 },
    { categories: ["Fraud"], factor: 0.8 },
  ],
};

interface MatchInput {
  platform: Platform;
  content: ContentAnalysis;
  /** Distinct accounts posting near-identical text (0 if none). */
  coordinationAccounts?: number;
}

/**
 * Suggests which platform rules a post MAY relate to. It never decides that a
 * violation occurred: every match is "NEEDS_REVIEW" and carries whether the
 * rule text itself has been verified against the official source.
 */
export function matchPolicy(input: MatchInput, rules: PolicyRule[]): PolicyMatch[] {
  const platformRules = rules.filter((r) => r.platform === input.platform);
  const matches = new Map<string, PolicyMatch>();

  const consider = (category: PolicyCategory, confidence: number, evidence: string[]) => {
    for (const rule of platformRules) {
      if (rule.category !== category) continue;
      const existing = matches.get(rule.id);
      if (existing && existing.confidence >= confidence) continue;
      matches.set(rule.id, {
        ruleId: rule.id,
        platform: rule.platform,
        category: rule.category,
        rule: rule.rule,
        officialUrl: rule.officialUrl,
        ruleVerified: rule.verification === "verified_against_official_source",
        confidence: Math.round(confidence * 100) / 100,
        evidence,
        status: "NEEDS_REVIEW",
      });
    }
  };

  for (const key of input.content.flagged) {
    const ind = input.content.indicators[key];
    for (const { categories, factor } of CATEGORY_MAP[key]) {
      for (const category of categories) consider(category, ind.confidence * factor, ind.evidence);
    }
  }
  if ((input.coordinationAccounts ?? 0) >= 3) {
    const n = input.coordinationAccounts!;
    consider("Platform Manipulation", Math.min(0.8, 0.3 + 0.1 * n), [
      `${n} accounts posted near-identical text within 48 hours`,
    ]);
  }

  return [...matches.values()].sort((a, b) => b.confidence - a.confidence);
}
