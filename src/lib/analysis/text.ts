/** Text helpers shared by the analysis modules. Pure functions, no I/O. */

export function tokenize(text: string): string[] {
  return text.toLowerCase().match(/[\p{L}\p{N}'-]+/gu) ?? [];
}

export function countUrls(text: string): number {
  return (text.match(/https?:\/\/\S+/gi) ?? []).length;
}

export function countHashtags(text: string): number {
  return (text.match(/#[\p{L}\p{N}_]+/gu) ?? []).length;
}

export function includesPhrase(lowerText: string, phrase: string): boolean {
  return lowerText.includes(phrase);
}

export function unique<T>(items: T[]): T[] {
  return [...new Set(items)];
}

export const clamp = (n: number, min: number, max: number) =>
  Math.min(max, Math.max(min, n));

/** Jaccard similarity of the word sets of two texts (0–1). */
export function textSimilarity(a: string, b: string): number {
  const sa = new Set(tokenize(a));
  const sb = new Set(tokenize(b));
  if (sa.size === 0 || sb.size === 0) return 0;
  let inter = 0;
  for (const t of sa) if (sb.has(t)) inter++;
  return inter / (sa.size + sb.size - inter);
}
