import type { Comment, CommentAnalysis, CommentCategory } from "@/types";
import { analyzeContent } from "./indicators";

interface Verdict {
  category: CommentCategory;
  confidence: number;
  reason: string;
}

/** Classifies one comment into the categories shown on /analysis/comments. */
export function analyzeComment(comment: Pick<Comment, "id" | "text">): CommentAnalysis {
  const a = analyzeContent(comment.text);
  const { threat, hate_speech, harassment, spam } = a.indicators;
  const alnum = comment.text.replace(/[^\p{L}\p{N}]/gu, "");

  const fromIndicator = (ind: { confidence: number; reason: string }, category: CommentCategory): Verdict => ({
    category,
    confidence: ind.confidence,
    reason: ind.reason,
  });

  // Priority: threat > hate speech > harassment > spam > plain sentiment.
  const verdict = ((): Verdict => {
    if (threat.detected) return fromIndicator(threat, "Threat Indicator");
    if (hate_speech.detected) return fromIndicator(hate_speech, "Hate Speech Indicator");
    if (harassment.detected) return fromIndicator(harassment, "Harassment");
    if (spam.detected) return fromIndicator(spam, "Spam");
    if (alnum.length < 3) {
      return { category: "Other", confidence: 0.6, reason: "No readable text (emoji, punctuation or very short)." };
    }
    const s = a.sentiment;
    return {
      category: s.sentiment === "positive" ? "Positive" : s.sentiment === "negative" ? "Negative" : "Neutral",
      confidence: s.confidence,
      reason: s.reason,
    };
  })();

  return {
    commentId: comment.id,
    ...verdict,
    sentiment: a.sentiment.sentiment,
    toxicity: a.toxicity,
  };
}

export function analyzeComments(comments: Pick<Comment, "id" | "text">[]): CommentAnalysis[] {
  return comments.map(analyzeComment);
}
