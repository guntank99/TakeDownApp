/**
 * Platform rules change. A rule not re-checked against its official source for
 * a long time may be out of date, so it is flagged and a human must re-verify
 * before relying on it in a report.
 */
export const POLICY_STALE_DAYS = 180;

export function policyAgeDays(lastVerified: string, now: number): number {
  const t = Date.parse(lastVerified);
  return Number.isNaN(t) ? Number.POSITIVE_INFINITY : Math.max(0, Math.floor((now - t) / 86_400_000));
}

/** True when the rule was last verified more than POLICY_STALE_DAYS ago (or the date is unreadable). */
export const isPolicyStale = (lastVerified: string, now: number): boolean => policyAgeDays(lastVerified, now) > POLICY_STALE_DAYS;
