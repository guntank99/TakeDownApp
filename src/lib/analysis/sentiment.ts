import type { Sentiment, SentimentResult } from "@/types";
import {
  NEGATIVE,
  NEGATIVE_PHRASES,
  NEGATORS,
  POSITIVE,
  POSITIVE_PHRASES,
} from "./lexicon";
import { clamp, tokenize } from "./text";

/**
 * Lexicon-based sentiment with simple negation handling (a negator within
 * the two preceding words flips the polarity). Replaceable by an NLP API or
 * local model: keep the SentimentResult shape and the UI needs no change.
 */
export function analyzeSentiment(text: string): SentimentResult {
  const lower = text.toLowerCase();
  const tokens = tokenize(text);
  let pos = 0;
  let neg = 0;
  const keywords: string[] = [];

  tokens.forEach((token, i) => {
    const isPos = POSITIVE.has(token);
    const isNeg = NEGATIVE.has(token);
    if (!isPos && !isNeg) return;
    const negated = tokens.slice(Math.max(0, i - 2), i).some((t) => NEGATORS.has(t));
    const positive = negated ? !isPos : isPos;
    if (positive) pos++;
    else neg++;
    keywords.push(negated ? `not ${token}` : token);
  });
  for (const p of POSITIVE_PHRASES) {
    if (!lower.includes(p)) continue;
    pos++;
    keywords.push(p);
  }
  for (const p of NEGATIVE_PHRASES) {
    if (!lower.includes(p)) continue;
    neg++;
    keywords.push(p);
  }

  const hits = pos + neg;
  if (hits === 0) {
    return {
      sentiment: "neutral",
      confidence: 0.55,
      reason: "No sentiment keywords detected.",
      keywords: [],
    };
  }

  const score = (pos - neg) / hits;
  const sentiment: Sentiment = score >= 0.25 ? "positive" : score <= -0.25 ? "negative" : "neutral";
  const confidence = clamp(0.5 + 0.08 * Math.min(hits, 4) + 0.2 * Math.abs(score), 0.5, 0.95);
  const reason =
    sentiment === "neutral"
      ? `Mixed or balanced sentiment keywords (${pos} positive, ${neg} negative).`
      : `${sentiment === "positive" ? pos : neg} of ${hits} sentiment keywords point ${sentiment}.`;

  return { sentiment, confidence: Math.round(confidence * 100) / 100, reason, keywords };
}
