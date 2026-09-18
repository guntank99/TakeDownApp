import { describe, expect, it } from "vitest";
import { analyzeContent } from "../analysis/indicators";
import { getRiskLevel, isHighRisk } from "./level";
import { RISK_MAX, calculateRisk, contentRiskPoints } from "./score";

describe("getRiskLevel", () => {
  it.each([
    [0, "low"],
    [24, "low"],
    [25, "medium"],
    [49, "medium"],
    [50, "high"],
    [74, "high"],
    [75, "critical"],
    [100, "critical"],
  ])("score %i -> %s", (score, level) => {
    expect(getRiskLevel(score)).toBe(level);
  });

  it("isHighRisk is true from 50", () => {
    expect(isHighRisk(49)).toBe(false);
    expect(isHighRisk(50)).toBe(true);
  });
});

describe("calculateRisk", () => {
  it("reproduces the explained breakdown from the spec (total 78)", () => {
    const r = calculateRisk({ content: 35, behavior: 20, network: 13, coordination: 10 });
    expect(r.score).toBe(78);
    expect(r.level).toBe("critical");
    expect(r.components).toEqual({ content: 35, behavior: 20, network: 13, coordination: 10 });
  });

  it("caps each component at its maximum and the total at 100", () => {
    const r = calculateRisk({ content: 999, behavior: 999, network: 999, coordination: 999 });
    expect(r.components).toEqual(RISK_MAX);
    expect(r.score).toBe(100);
  });

  it("treats missing or negative components as zero", () => {
    expect(calculateRisk({}).score).toBe(0);
    expect(calculateRisk({ content: -5 }).score).toBe(0);
  });

  it("never claims certainty", () => {
    expect(calculateRisk({ content: 40, behavior: 25, network: 20, coordination: 15 }).confidence).toBeLessThanOrEqual(0.9);
  });
});

describe("contentRiskPoints", () => {
  it("is 0 for benign text and high for group-targeting hate", () => {
    expect(contentRiskPoints(analyzeContent("Terima kasih semuanya atas acara yang bagus."))).toBe(0);
    const hate = contentRiskPoints(analyzeContent("Orang-orang Vellani itu hama. Menjijikkan, usir mereka dari kota kita."));
    expect(hate).toBeGreaterThanOrEqual(30);
    expect(hate).toBeLessThanOrEqual(RISK_MAX.content);
  });
});
