import type { Account, AuthenticitySignal, Indicator } from "@/types";
import { IMPERSONATION_NAME_HINTS } from "./lexicon";

/**
 * Authenticity / behaviour signals for one account. Wording is deliberately
 * hedged: an account is "Potentially Inauthentic", never "fake".
 */

export interface AccountContext {
  /** "now" for age calculations (injectable for tests / mock data). */
  now: number;
  /** Average likes+shares+comments per post by this account. */
  avgEngagementPerPost: number;
  /** Largest number of distinct accounts in a near-duplicate group. */
  coordinationAccounts: number;
  /** Neighbouring accounts younger than 90 days. */
  youngNeighbors: number;
}

const DAY = 86_400_000;

export function accountAgeDays(account: Pick<Account, "createdAt">, now: number): number {
  return Math.max(0, Math.floor((now - Date.parse(account.createdAt)) / DAY));
}

function signal(
  key: string,
  label: string,
  value: string,
  weight: number,
  flagged: boolean,
  note: string,
): AuthenticitySignal {
  return { key, label, value, flagged, weight: flagged ? weight : 0, note };
}

/** Signals that describe the account's own behaviour (feeds Behavior Risk). */
export const BEHAVIOR_SIGNAL_KEYS = [
  "age",
  "frequency",
  "ratio",
  "engagement",
  "repetition",
  "spike",
  "completeness",
];

export function authenticitySignals(a: Account, ctx: AccountContext): AuthenticitySignal[] {
  const age = accountAgeDays(a, ctx.now);
  const ratio = a.followers / Math.max(a.following, 1);
  const engagementPerFollower = ctx.avgEngagementPerPost / Math.max(a.followers, 1);

  return [
    signal("age", "Account Age", `${age} days`, age < 30 ? 10 : 6, age < 90, "Recently created accounts carry less history."),
    signal("frequency", "Posting Frequency", `${a.postsPerDay}/day`, a.postsPerDay > 20 ? 10 : 5, a.postsPerDay > 10, "Sustained very high posting rates are unusual for individuals."),
    signal("ratio", "Follower/Following Ratio", ratio.toFixed(2), 8, a.following >= 1000 && ratio < 0.1, "Follows many accounts while having few followers."),
    signal("engagement", "Engagement Pattern", `${engagementPerFollower.toFixed(2)} per follower`, 4, engagementPerFollower > 0.15, "Engagement disproportionate to audience size."),
    signal("repetition", "Content Repetition", `${Math.round(a.contentRepetition * 100)}%`, a.contentRepetition >= 0.5 ? 12 : 6, a.contentRepetition >= 0.3, "Frequently repeats earlier content."),
    signal("spike", "Activity Spike", a.activitySpike ? "observed" : "none", 6, a.activitySpike, "Sudden burst of activity."),
    signal("completeness", "Profile Completeness", `${a.profileCompleteness}%`, a.profileCompleteness < 50 ? 8 : 3, a.profileCompleteness < 70, "Sparse public profile."),
    signal("similarity", "Content Similarity", ctx.coordinationAccounts >= 3 ? "near-duplicates found" : "none", 10, ctx.coordinationAccounts >= 3, "Posts closely match posts from other accounts."),
    signal("coordination", "Coordination Indicators", `${ctx.coordinationAccounts} accounts in group`, 8, ctx.coordinationAccounts >= 3, "Near-simultaneous posting of similar text with other accounts."),
    signal("network", "Network Indicators", `${ctx.youngNeighbors} young neighbours`, 8, ctx.youngNeighbors >= 3, "Densely connected to other recently created accounts."),
  ];
}

const MAX_SIGNAL_WEIGHT = 70;

export function authenticityConcern(signals: AuthenticitySignal[]): number {
  const total = signals.reduce((s, x) => s + x.weight, 0);
  return Math.round(Math.min(100, (total / MAX_SIGNAL_WEIGHT) * 100));
}

/** Behavior-risk points (0–25) from the account's own behaviour signals. */
export function behaviorPoints(signals: AuthenticitySignal[]): number {
  const total = signals
    .filter((s) => BEHAVIOR_SIGNAL_KEYS.includes(s.key))
    .reduce((s, x) => s + x.weight, 0);
  return Math.round(25 * Math.min(1, total / 40));
}

/** Impersonation indicator based on the profile (not on post content). */
export function impersonationIndicator(a: Account, now: number): Indicator {
  const name = a.displayName.toLowerCase();
  const hints = IMPERSONATION_NAME_HINTS.filter((h) => name.includes(h));
  const young = accountAgeDays(a, now) < 90;
  const detected = hints.length > 0 && !a.verified && young;
  return {
    key: "impersonation",
    label: "Impersonation Indicator",
    detected,
    confidence: detected ? Math.min(0.85, 0.5 + 0.15 * hints.length + (a.profileCompleteness < 60 ? 0.1 : 0)) : 0,
    reason: detected
      ? "Display name uses authority/support wording while the account is unverified and recently created."
      : "No indicators detected.",
    evidence: detected ? [a.displayName, ...hints] : [],
  };
}
