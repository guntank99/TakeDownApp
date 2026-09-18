/**
 * Small bilingual (English / Indonesian) keyword lexicon used by the
 * rule-based "lexicon-v1" engine. It is deliberately simple and transparent:
 * every hit can be shown to an analyst as evidence. It WILL produce false
 * positives and false negatives — that is why every result requires review.
 *
 * Group-targeting terms use only fictional groups plus generic collectives.
 */

const set = (s: string) => new Set(s.split(/\s*,\s*/).map((x) => x.trim()).filter(Boolean));

export const POSITIVE = set(
  "good, great, excellent, love, thank, thanks, happy, helpful, support, amazing, wonderful, appreciate, proud, success, successful, congratulations, well, bagus, baik, mantap, bangga, senang, hebat, sukses, mendukung, keren, setuju",
);
export const POSITIVE_PHRASES = ["terima kasih", "luar biasa", "well said"];

export const NEGATIVE = set(
  "bad, terrible, awful, hate, angry, worst, disappointing, disappointed, fail, failure, corrupt, scam, fraud, disgusting, outrage, unacceptable, shame, lie, lies, liar, thief, stole, cover-up, buruk, jelek, marah, kecewa, gagal, korupsi, penipu, bohong, benci, parah, memalukan, mengecewakan, sampah",
);
export const NEGATIVE_PHRASES = ["not happy", "shame on"];

export const NEGATORS = set(
  "not, no, never, tidak, bukan, jangan, belum, don't, isn't, aren't, wasn't, can't, won't, didn't, cannot",
);

/** General insults / profanity → toxicity signal. */
export const PROFANITY = set(
  "idiot, idiots, stupid, moron, dumb, pathetic, loser, worthless, disgusting, filth, filthy, trash, crap, damn, sucks, bodoh, goblok, tolol, bego, dungu, sampah, jelek",
);

/** Derogatory terms often used against groups (generic, not real slurs). */
export const DEROGATORY = set(
  "vermin, scum, filth, filthy, parasite, parasites, subhuman, cockroach, cockroaches, plague, disgusting, hama, binatang, kotor",
);
/** Subset that compares people to non-human things → dehumanization. */
export const DEHUMANIZING = set(
  "vermin, parasite, parasites, subhuman, cockroach, cockroaches, plague, hama, binatang",
);
export const INCITEMENT = [
  "drive them out",
  "kicked out",
  "kick them out",
  "get out",
  "go away",
  "should be removed",
  "wipe them out",
  "usir",
];
export const GROUP_TERMS = set(
  "vellani, norrin, tessarian, tessarians, immigrants, refugees, foreigners, migrants, minorities, newcomers, outsiders",
);

export const HARASS_INSULTS =
  "idiot|stupid|moron|pathetic|loser|ugly|dumb|worthless|bodoh|goblok|tolol|jelek|bego|dungu";
export const HARASS_PHRASES = ["shut up", "nobody likes you", "diam saja", "diam kamu"];

export const THREAT_PATTERNS: RegExp[] = [
  /\b(?:kill|hurt|find|destroy|hunt)\s+you\b/i,
  /\bwatch your back\b/i,
  /\byou(?:'ll| will) (?:regret|pay)\b/i,
  /\bi(?:'ll| will) find you\b/i,
  /\b(?:bunuh|habisi|kuhabisi|kubunuh)\b/i,
  /\bawas kamu\b/i,
];

export const SPAM_PHRASES = [
  "free followers",
  "click here",
  "buy now",
  "dm for",
  "join now",
  "giveaway",
  "promo",
  "link in bio",
];

export const MISINFO_CUES = [
  "don't want you to know",
  "100% true",
  "share before",
  "before it's deleted",
  "before it is deleted",
  "sebelum dihapus",
  "cover-up",
  "cover up",
  "wake up",
  "secret document",
  "forward this",
  "viralkan",
  "sebarkan",
  "katanya",
  "konon",
  "rekayasa",
];
/** Words that suggest the post cites a source; lowers misinformation confidence. */
export const SOURCE_MARKERS = [
  "according to",
  "official",
  "published",
  "report",
  "sumber",
  "resmi",
  "court",
  "putusan",
];

export const ACCUSATION_TERMS = set(
  "thief, corrupt, fraud, scammer, criminal, liar, cheat, embezzled, embezzler, stole, bribed, koruptor, maling, penipu, menggelapkan, penggelapan, pembohong",
);
export const ATTRIBUTION_MARKERS = [
  "according to",
  "court",
  "police",
  "reportedly",
  "alleged",
  "putusan",
  "sumber",
];

export const IMPERSONATION_NAME_HINTS = [
  "official",
  "support",
  "help desk",
  "helpdesk",
  "customer care",
  "admin",
  "resmi",
];
export const PHISHING_PHRASES = [
  "verify your account",
  "avoid suspension",
  "official notice",
  "verifikasi akun",
  "tim resmi",
];
