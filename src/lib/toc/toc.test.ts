import { describe, expect, it } from "vitest";
import type { PolicyRule } from "@/types";
import { analyzeContent } from "../analysis/indicators";
import { matchPolicy } from "./match";

const rule = (id: string, platform: PolicyRule["platform"], category: PolicyRule["category"], verified = true): PolicyRule => ({
  id, platform, category, rule: `Rule ${id}`, description: "d", evidenceRequirement: "e", severity: "high",
  policyVersion: "v", officialUrl: "https://example.test/policy", lastUpdated: "2026-09-18",
  verification: verified ? "verified_against_official_source" : "needs_verification",
});

const rules = [
  rule("1", "x", "Hate Speech", false),
  rule("2", "facebook", "Hate Speech"),
  rule("3", "facebook", "Platform Manipulation"),
  rule("4", "facebook", "Harassment"),
];

const hateText = "The Vellani are vermin. Disgusting people, drive them out of our city.";

describe("matchPolicy", () => {
  it("matches only rules of the post's platform and marks them for review", () => {
    const m = matchPolicy({ platform: "facebook", content: analyzeContent(hateText) }, rules);
    expect(m.map((x) => x.ruleId)).toEqual(["2"]);
    expect(m[0].status).toBe("NEEDS_REVIEW");
    expect(m[0].ruleVerified).toBe(true);
  });

  it("carries the 'rule not verified' flag through", () => {
    const m = matchPolicy({ platform: "x", content: analyzeContent(hateText) }, rules);
    expect(m).toHaveLength(1);
    expect(m[0].ruleVerified).toBe(false);
  });

  it("returns nothing for benign content and for platforms without rules", () => {
    const benign = analyzeContent("Thanks everyone, great event.");
    expect(matchPolicy({ platform: "facebook", content: benign }, rules)).toEqual([]);
    expect(matchPolicy({ platform: "news", content: analyzeContent(hateText) }, rules)).toEqual([]);
  });

  it("adds a Platform Manipulation match for coordinated posting", () => {
    const m = matchPolicy(
      { platform: "facebook", content: analyzeContent("Nice day"), coordinationAccounts: 5 },
      rules,
    );
    expect(m.map((x) => x.ruleId)).toEqual(["3"]);
    expect(m[0].confidence).toBeLessThanOrEqual(0.8);
  });

  it("lowers confidence when defamation is mapped onto harassment", () => {
    const content = analyzeContent("Mr. Dorian Vale is a corrupt thief and a fraud, he stole the fund.");
    const m = matchPolicy({ platform: "facebook", content }, rules);
    const h = m.find((x) => x.category === "Harassment")!;
    expect(h.confidence).toBeLessThan(content.indicators.defamation.confidence);
  });
});
