import { describe, expect, it } from "vitest";
import { analyzeComment } from "./comments";
import { coordinationPoints, findCoordinatedGroups } from "./coordination";
import { analyzeContent } from "./indicators";
import { analyzeSentiment } from "./sentiment";

describe("analyzeSentiment", () => {
  it("detects positive text (English)", () => {
    const r = analyzeSentiment("Great work by the team, thank you for the support!");
    expect(r.sentiment).toBe("positive");
    expect(r.keywords).toContain("great");
  });

  it("detects negative text (Indonesian)", () => {
    expect(analyzeSentiment("Kebijakan ini buruk dan mengecewakan").sentiment).toBe("negative");
  });

  it("handles negation", () => {
    expect(analyzeSentiment("This is not good").sentiment).toBe("negative");
    expect(analyzeSentiment("This is not bad").sentiment).toBe("positive");
  });

  it("returns neutral with a reason when nothing matches", () => {
    const r = analyzeSentiment("The schedule was published on Monday.");
    expect(r.sentiment).toBe("neutral");
    expect(r.reason).toMatch(/no sentiment keywords/i);
  });

  it("keeps confidence within 0.5–0.95", () => {
    const r = analyzeSentiment("terrible awful worst bad hate failure");
    expect(r.confidence).toBeGreaterThanOrEqual(0.5);
    expect(r.confidence).toBeLessThanOrEqual(0.95);
  });
});

describe("analyzeContent indicators", () => {
  it("flags group-targeting derogatory language for human review", () => {
    const a = analyzeContent("The Vellani are vermin. Disgusting people, drive them out of our city.");
    expect(a.indicators.hate_speech.detected).toBe(true);
    expect(a.indicators.hate_speech.confidence).toBeGreaterThanOrEqual(0.5);
    expect(a.status).toBe("NEEDS_HUMAN_REVIEW");
    expect(a.indicators.hate_speech.reason).toMatch(/potential/i);
  });

  it("does not flag a neutral announcement", () => {
    const a = analyzeContent("Update: the published schedule for the coming week is available. #TransitUpdate");
    expect(a.flagged).toEqual([]);
    expect(a.status).toBe("NO_INDICATORS");
    expect(a.toxicity).toBe(0);
  });

  it("insulting a non-group is toxicity but not hate speech", () => {
    const a = analyzeContent("The officials behind this are idiots and it is a disgusting failure.");
    expect(a.indicators.hate_speech.detected).toBe(false);
    expect(a.toxicity).toBeGreaterThan(0);
  });

  it("detects threats", () => {
    const a = analyzeContent("You will regret this, watch your back.");
    expect(a.indicators.threat.detected).toBe(true);
    expect(a.indicators.threat.evidence.length).toBe(2);
  });

  it("detects harassment aimed at a person", () => {
    const a = analyzeContent("@someone you are a pathetic idiot, shut up.");
    expect(a.indicators.harassment.detected).toBe(true);
  });

  it("detects spam and phishing-style impersonation", () => {
    const spam = analyzeContent(
      "FREE followers!!! Click here http://promo-deals.example/a http://promo-deals.example/b buy now #promo #free #win #sale #deal",
    );
    expect(spam.indicators.spam.detected).toBe(true);
    const phish = analyzeContent("Official notice: verify your account now at http://verify-support.example/login to avoid suspension.");
    expect(phish.indicators.impersonation.detected).toBe(true);
  });

  it("flags misinformation cues but not claims that cite a source", () => {
    const cue = analyzeContent("They don't want you to know this. 100% true, share before it's deleted!");
    expect(cue.indicators.misinformation.detected).toBe(true);
    expect(cue.indicators.misinformation.reason).toMatch(/not a finding/i);
    const sourced = analyzeContent("According to the official published report, the schedule changed.");
    expect(sourced.indicators.misinformation.detected).toBe(false);
  });

  it("requires a named target for defamation indicators", () => {
    const named = analyzeContent("Mr. Dorian Vale is a corrupt thief and a fraud, he stole the fund.");
    expect(named.indicators.defamation.detected).toBe(true);
    expect(named.indicators.defamation.reason).toMatch(/human \/ legal review/i);
    const unnamed = analyzeContent("The company is corrupt.");
    expect(unnamed.indicators.defamation.detected).toBe(false);
  });

  it("never reports confidence above 0.95 or for undetected indicators", () => {
    const a = analyzeContent("Those Vellani are vermin, subhuman filth. Get out! Drive them out. Kicked out.");
    for (const ind of Object.values(a.indicators)) {
      expect(ind.confidence).toBeLessThanOrEqual(0.95);
      if (!ind.detected) expect(ind.confidence).toBe(0);
    }
  });
});

describe("analyzeComment", () => {
  const cat = (text: string) => analyzeComment({ id: "c", text }).category;
  it("prioritises threat > hate > harassment > spam > sentiment", () => {
    expect(cat("You will regret this, watch your back.")).toBe("Threat Indicator");
    expect(cat("Those Vellani are vermin.")).toBe("Hate Speech Indicator");
    expect(cat("Shut up, nobody likes you.")).toBe("Harassment");
    expect(cat("DM for promo!!! join now")).toBe("Spam");
    expect(cat("Thanks for sharing, very helpful.")).toBe("Positive");
    expect(cat("Total failure, shame on them.")).toBe("Negative");
    expect(cat("Any update on this?")).toBe("Neutral");
    expect(cat("👍")).toBe("Other");
  });
});

describe("findCoordinatedGroups", () => {
  const base = "BREAKING: secret claim about the dam. Share before it is deleted!";
  const mk = (id: string, authorId: string, text: string, iso: string) => ({ id, authorId, text, createdAt: iso });

  it("groups near-duplicate posts from 3+ accounts inside the window", () => {
    const groups = findCoordinatedGroups([
      mk("p1", "a1", base, "2026-09-16T10:00:00Z"),
      mk("p2", "a2", base + " RT!", "2026-09-16T10:20:00Z"),
      mk("p3", "a3", base + " #wakeup", "2026-09-16T10:40:00Z"),
      mk("p4", "a4", "Completely unrelated recipe for soup", "2026-09-16T10:50:00Z"),
    ]);
    expect(groups.get("p1")?.accounts).toBe(3);
    expect(groups.has("p4")).toBe(false);
  });

  it("ignores repeats by the same account and posts outside the window", () => {
    expect(
      findCoordinatedGroups([
        mk("p1", "a1", base, "2026-09-16T10:00:00Z"),
        mk("p2", "a1", base, "2026-09-16T10:05:00Z"),
        mk("p3", "a2", base, "2026-09-16T10:10:00Z"),
        mk("p4", "a3", base, "2026-09-20T10:10:00Z"),
      ]).size,
    ).toBe(0);
  });

  it("scales coordination points to a 15 maximum", () => {
    expect(coordinationPoints(2)).toBe(0);
    expect(coordinationPoints(3)).toBe(8);
    expect(coordinationPoints(5)).toBe(15);
    expect(coordinationPoints(50)).toBe(15);
  });
});
