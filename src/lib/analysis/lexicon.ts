/**
 * Small bilingual (Indonesian / English) keyword lexicon used by the
 * rule-based "lexicon-v1" engine. It is deliberately simple and transparent:
 * every hit can be shown to an analyst as evidence. It WILL produce false
 * positives and false negatives (sarcasm, slang, context), which is why every
 * result requires human review.
 *
 * Group-targeting rules use fictional groups plus generic collectives only.
 */

const set = (s: string) => new Set(s.split(/\s*,\s*/).map((x) => x.trim()).filter(Boolean));

export const POSITIVE = set(
  "bagus, baik, mantap, bangga, senang, hebat, sukses, mendukung, keren, setuju, apresiasi, bermanfaat, membantu, lancar, puas, selamat, terbaik, solutif, transparan, adil, semangat, good, great, excellent, love, thank, thanks, happy, helpful, support, amazing, wonderful, appreciate, proud, success, successful, congratulations, well",
);
export const POSITIVE_PHRASES = ["terima kasih", "luar biasa", "kerja bagus", "sangat membantu", "well said"];

export const NEGATIVE = set(
  "buruk, jelek, marah, kecewa, gagal, korupsi, penipu, bohong, benci, parah, memalukan, mengecewakan, sampah, meresahkan, susah, rugi, mahal, bobrok, menyedihkan, curang, zalim, menyesal, hoaks, fitnah, bad, terrible, awful, hate, angry, worst, disappointing, disappointed, fail, failure, corrupt, scam, fraud, disgusting, outrage, unacceptable, shame, lie, lies, liar, thief, stole, cover-up",
);
export const NEGATIVE_PHRASES = ["tidak adil", "bikin susah", "gagal total", "not happy", "shame on"];

export const NEGATORS = set(
  "tidak, bukan, jangan, belum, nggak, gak, ga, enggak, tak, not, no, never, don't, isn't, aren't, wasn't, can't, won't, didn't, cannot",
);

/** General insults / profanity → toxicity signal. */
export const PROFANITY = set(
  "bodoh, goblok, tolol, bego, dungu, sampah, jelek, bangsat, brengsek, sialan, anjing, idiot, idiots, stupid, moron, dumb, pathetic, loser, worthless, disgusting, filth, filthy, trash, crap, damn, sucks",
);

/** Derogatory terms often used against groups (generic, not real slurs). */
export const DEROGATORY = set(
  "hama, binatang, kotor, parasit, najis, menjijikkan, cecunguk, kecoa, vermin, scum, filth, filthy, parasite, parasites, subhuman, cockroach, cockroaches, plague, disgusting",
);
/** Subset that compares people to non-human things → dehumanization. */
export const DEHUMANIZING = set(
  "hama, binatang, parasit, cecunguk, kecoa, vermin, parasite, parasites, subhuman, cockroach, cockroaches, plague",
);
export const INCITEMENT = [
  "usir",
  "diusir",
  "enyahkan",
  "pergi dari sini",
  "angkat kaki",
  "singkirkan",
  "drive them out",
  "kicked out",
  "kick them out",
  "get out",
  "go away",
  "should be removed",
  "wipe them out",
];
export const GROUP_TERMS = set(
  "vellani, norrin, tessarian, tessarians, pendatang, imigran, pengungsi, minoritas, warga asing, immigrants, refugees, foreigners, migrants, minorities, newcomers, outsiders",
);

export const HARASS_INSULTS =
  "bodoh|goblok|tolol|jelek|bego|dungu|payah|bangsat|brengsek|sialan|idiot|stupid|moron|pathetic|loser|ugly|dumb|worthless";
export const HARASS_PHRASES = ["diam saja", "diam kamu", "tutup mulut", "tidak ada yang suka", "shut up", "nobody likes you"];

export const THREAT_PATTERNS: RegExp[] = [
  /\bawas kamu\b/i,
  /\bkuhabisi\b/i,
  /\bkubunuh\b/i,
  /\bkubakar\b/i,
  /\bkamu akan menyesal\b/i,
  /\btunggu (?:saja )?(?:akibatnya|pembalasan)\b/i,
  /\b(?:habisi|bunuh|bakar) kamu\b/i,
  /\b(?:kill|hurt|find|destroy|hunt)\s+you\b/i,
  /\bwatch your back\b/i,
  /\byou(?:'ll| will) (?:regret|pay)\b/i,
  /\bi(?:'ll| will) find you\b/i,
];

export const SPAM_PHRASES = [
  "gratis followers",
  "klik di sini",
  "beli sekarang",
  "hubungi dm",
  "gabung sekarang",
  "link di bio",
  "diskon besar",
  "cek link",
  "giveaway",
  "promo",
  "free followers",
  "click here",
  "buy now",
  "dm for",
  "join now",
];

export const MISINFO_CUES = [
  "yang tidak mau kamu tahu",
  "yang tidak mau anda tahu",
  "100% benar",
  "sebarkan sebelum",
  "sebelum dihapus",
  "bagikan ke semua",
  "jangan percaya media",
  "dokumen rahasia",
  "terbongkar",
  "heboh",
  "viralkan",
  "sebarkan",
  "katanya",
  "konon",
  "rekayasa",
  "bangun dan",
  "don't want you to know",
  "100% true",
  "share before",
  "before it's deleted",
  "cover-up",
  "cover up",
  "wake up",
  "secret document",
  "forward this",
];
/** Words that suggest the post cites a source; lowers misinformation confidence. */
export const SOURCE_MARKERS = [
  "menurut",
  "laporan",
  "resmi",
  "sumber",
  "pengadilan",
  "putusan",
  "dipublikasikan",
  "diumumkan",
  "kementerian",
  "instansi",
  "bmkg",
  "according to",
  "official",
  "published",
  "report",
  "court",
];

export const ACCUSATION_TERMS = set(
  "koruptor, korup, maling, pencuri, mencuri, penipu, pembohong, menggelapkan, penggelapan, curang, penjahat, menyuap, thief, corrupt, fraud, scammer, criminal, liar, cheat, embezzled, embezzler, stole, bribed",
);
export const ATTRIBUTION_MARKERS = [
  "menurut",
  "diduga",
  "dugaan",
  "kepolisian",
  "pengadilan",
  "putusan",
  "laporan",
  "sumber",
  "according to",
  "court",
  "police",
  "reportedly",
  "alleged",
];
export const BOAST_RE = /semua orang tahu|tidak perlu bukti|pasti benar|everyone knows|no proof needed/i;

export const IMPERSONATION_NAME_HINTS = [
  "resmi",
  "layanan pelanggan",
  "pusat bantuan",
  "admin",
  "official",
  "support",
  "help desk",
  "helpdesk",
  "customer care",
];
export const PHISHING_PHRASES = [
  "verifikasi akun",
  "agar tidak diblokir",
  "akun anda akan diblokir",
  "pemberitahuan resmi",
  "tim resmi",
  "verify your account",
  "avoid suspension",
  "official notice",
];
