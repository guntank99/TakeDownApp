import type { ContentAnalysis, Indicator, IndicatorKey } from "@/types";
import { analyzeSentiment } from "./sentiment";
import {
  ACCUSATION_TERMS,
  ATTRIBUTION_MARKERS,
  BOAST_RE,
  DEHUMANIZING,
  DEROGATORY,
  GROUP_TERMS,
  HARASS_INSULTS,
  HARASS_PHRASES,
  INCITEMENT,
  MISINFO_CUES,
  PHISHING_PHRASES,
  PROFANITY,
  SOURCE_MARKERS,
  SPAM_PHRASES,
  THREAT_PATTERNS,
} from "./lexicon";
import { clamp, countHashtags, countUrls, tokenize, unique } from "./text";

export const ENGINE_NAME = "lexicon-v1";

export const INDICATOR_LABELS: Record<IndicatorKey, string> = {
  hate_speech: "Indikator Ujaran Kebencian",
  harassment: "Indikator Pelecehan",
  threat: "Indikator Ancaman",
  spam: "Indikator Spam",
  misinformation: "Indikator Misinformasi",
  defamation: "Indikator Pencemaran Nama Baik",
  impersonation: "Indikator Peniruan Identitas",
};

/** Short form for tables, e.g. "Ujaran Kebencian". */
export const indicatorShort = (key: IndicatorKey) => INDICATOR_LABELS[key].replace("Indikator ", "");

const r2 = (n: number) => Math.round(n * 100) / 100;
const NO_INDICATOR = "Tidak ada indikator yang terdeteksi.";

function make(
  key: IndicatorKey,
  detected: boolean,
  confidence: number,
  reason: string,
  evidence: string[],
): Indicator {
  return {
    key,
    label: INDICATOR_LABELS[key],
    detected,
    confidence: detected ? r2(clamp(confidence, 0, 0.95)) : 0,
    reason: detected ? reason : NO_INDICATOR,
    evidence: detected ? unique(evidence).slice(0, 6) : [],
  };
}

const GROUP_RE = new RegExp(`\\b(?:${[...GROUP_TERMS].join("|")})\\b`, "i");
const CAPS_GROUP_RE = /\b(?:[Tt]hose|[Tt]hese|[Aa]ll|[Oo]rang-orang|[Kk]aum|[Pp]ara|[Ss]emua)\s+[A-Z][a-z]{3,}s?\b/;
const INSULT_RE = new RegExp(
  `\\b(?:you|you're|you are|kamu|lu|lo|elu|anda|dirimu)\\b[^.!?]{0,20}\\b(?:${HARASS_INSULTS})\\b`,
  "i",
);
const DASAR_RE = new RegExp(`\\bdasar\\s+(?:${HARASS_INSULTS})\\b`, "i");
const TARGET_RE = /\b(?:Mr|Ms|Mrs|Dr|Prof|Pak|Bu|Bapak|Ibu|Sdr|Saudara|Saudari|Hj?)\.?\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?/;

function detectHate(text: string, lower: string, tokens: string[]): Indicator {
  const derog = unique(tokens.filter((t) => DEROGATORY.has(t)));
  const dehum = unique(tokens.filter((t) => DEHUMANIZING.has(t)));
  const group = GROUP_RE.exec(text)?.[0] ?? CAPS_GROUP_RE.exec(text)?.[0] ?? null;
  const incite = INCITEMENT.filter((p) => lower.includes(p));

  const confidence =
    (derog.length ? 0.35 : 0) + (group ? 0.25 : 0) + (dehum.length ? 0.2 : 0) + (incite.length ? 0.2 : 0);
  const detected = confidence >= 0.5 && (group !== null || dehum.length > 0);

  const parts = [
    derog.length && "bahasa merendahkan",
    group && "rujukan pada suatu kelompok",
    dehum.length && "perbandingan yang merendahkan martabat",
    incite.length && "kata bernada hasutan",
  ].filter(Boolean);
  return make(
    "hate_speech",
    detected,
    confidence,
    `Terdeteksi potensi penargetan yang merendahkan (${parts.join(", ")}).`,
    [...derog, ...(group ? [group] : []), ...incite],
  );
}

function detectHarassment(text: string, lower: string): Indicator {
  const phrases = HARASS_PHRASES.filter((p) => lower.includes(p));
  const evidence = [INSULT_RE.exec(text)?.[0], DASAR_RE.exec(text)?.[0], ...phrases].filter(
    (x): x is string => Boolean(x),
  );
  const hasMention = /(^|\s)@\w+/.test(text);
  const confidence = 0.55 + 0.12 * Math.max(0, evidence.length - 1) + (hasMention ? 0.1 : 0);
  return make(
    "harassment",
    evidence.length > 0,
    Math.min(confidence, 0.92),
    `Hinaan pribadi atau bahasa bermusuhan yang ditujukan kepada seseorang${hasMention ? " (ada sebutan akun)" : ""}.`,
    evidence,
  );
}

function detectThreat(text: string): Indicator {
  const hits = THREAT_PATTERNS.map((re) => re.exec(text)?.[0]).filter((x): x is string => Boolean(x));
  return make(
    "threat",
    hits.length > 0,
    0.7 + 0.1 * Math.max(0, hits.length - 1),
    "Bahasa yang mungkin menyatakan niat mencelakai; diperlukan konteks untuk menilai tingkat keseriusannya.",
    hits,
  );
}

function detectSpam(text: string, lower: string): Indicator {
  const urls = countUrls(text);
  const tags = countHashtags(text);
  const phrases = SPAM_PHRASES.filter((p) => lower.includes(p));
  const letters = text.replace(/[^\p{L}]/gu, "");
  const upperRatio = letters.length >= 10 ? letters.replace(/[^\p{Lu}]/gu, "").length / letters.length : 0;

  let confidence = 0;
  const evidence: string[] = [...phrases];
  const add = (points: number, note: string) => {
    confidence += points;
    evidence.push(note);
  };
  if (urls >= 2) add(0.3, `${urls} tautan`);
  confidence += Math.min(0.5, 0.25 * phrases.length);
  if (tags >= 5) add(0.2, `${tags} tagar`);
  if (upperRatio > 0.5) add(0.1, "sebagian besar huruf kapital");
  if (/!{3,}/.test(text)) add(0.1, "tanda seru berulang");

  return make("spam", confidence >= 0.5, confidence, "Pola promosi atau penumpukan tautan yang lazim pada spam.", evidence);
}

function detectMisinformation(lower: string): Indicator {
  const cues = MISINFO_CUES.filter((c) => lower.includes(c));
  const sources = SOURCE_MARKERS.filter((s) => lower.includes(s));
  const confidence = Math.min(0.9, 0.3 * cues.length - (sources.length ? 0.15 : 0));
  return make(
    "misinformation",
    confidence >= 0.5,
    confidence,
    "Terdeteksi bahasa klaim yang belum diverifikasi (kerahasiaan, urgensi, ajakan menyebarkan). Ini BUKAN temuan bahwa klaim tersebut keliru; verifikasi dengan sumber.",
    cues,
  );
}

function detectDefamation(text: string, lower: string, tokens: string[]): Indicator {
  const accusations = unique(tokens.filter((t) => ACCUSATION_TERMS.has(t)));
  const target = TARGET_RE.exec(text)?.[0] ?? /(^|\s)(@\w+)/.exec(text)?.[2] ?? null;
  const attributed = ATTRIBUTION_MARKERS.some((m) => lower.includes(m));
  const boast = BOAST_RE.test(text);
  const confidence =
    0.45 + 0.1 * Math.max(0, Math.min(accusations.length, 4) - 1) + (attributed ? 0 : 0.15) + (boast ? 0.1 : 0);
  return make(
    "defamation",
    accusations.length > 0 && target !== null,
    confidence,
    `Tuduhan yang ditujukan kepada orang tertentu tanpa sumber yang disebutkan${attributed ? " (ada kata atribusi)" : ""}. Memerlukan peninjauan manusia / hukum.`,
    [...(target ? [target] : []), ...accusations],
  );
}

function detectPhishing(text: string, lower: string): Indicator {
  const phrases = PHISHING_PHRASES.filter((p) => lower.includes(p));
  return make(
    "impersonation",
    phrases.length > 0 && countUrls(text) >= 1,
    0.55 + 0.1 * Math.max(0, phrases.length - 1),
    "Bahasa bernada otoritas yang disertai tautan, pola yang dipakai pada peniruan identitas / phishing.",
    phrases,
  );
}

/** Runs every content check on one piece of text. */
export function analyzeContent(text: string): ContentAnalysis {
  const lower = text.toLowerCase();
  const tokens = tokenize(text);

  const indicators: Record<IndicatorKey, Indicator> = {
    hate_speech: detectHate(text, lower, tokens),
    harassment: detectHarassment(text, lower),
    threat: detectThreat(text),
    spam: detectSpam(text, lower),
    misinformation: detectMisinformation(lower),
    defamation: detectDefamation(text, lower, tokens),
    impersonation: detectPhishing(text, lower),
  };

  const profanity = tokens.filter((t) => PROFANITY.has(t)).length;
  const toxicity = Math.round(
    100 *
      Math.max(
        indicators.hate_speech.detected ? indicators.hate_speech.confidence * 0.95 : 0,
        indicators.threat.detected ? indicators.threat.confidence : 0,
        indicators.harassment.detected ? indicators.harassment.confidence * 0.85 : 0,
        Math.min(1, 0.3 * profanity),
      ),
  );

  const flagged = (Object.keys(indicators) as IndicatorKey[]).filter((k) => indicators[k].detected);
  return {
    sentiment: analyzeSentiment(text),
    toxicity,
    indicators,
    flagged,
    status: flagged.length > 0 ? "NEEDS_HUMAN_REVIEW" : "NO_INDICATORS",
    engine: ENGINE_NAME,
  };
}
