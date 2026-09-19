import { describe, expect, it } from "vitest";
import { POLICY_STALE_DAYS, isPolicyStale, policyAgeDays } from "./freshness";

const now = Date.parse("2026-09-19T00:00:00Z");

describe("policy freshness", () => {
  it("recent verification is fresh, old verification is stale, the boundary is inclusive of the limit", () => {
    expect(isPolicyStale("2026-09-18", now)).toBe(false);
    expect(policyAgeDays("2026-09-18", now)).toBe(1);
    expect(isPolicyStale("2026-03-23", now)).toBe(false); // exactly 180 days
    expect(isPolicyStale("2026-03-22", now)).toBe(true); // 181 days
    expect(POLICY_STALE_DAYS).toBe(180);
  });

  it("an unreadable date is treated as stale rather than trusted", () => {
    expect(isPolicyStale("kemarin", now)).toBe(true);
    expect(isPolicyStale("", now)).toBe(true);
  });
});
