/**
 * Deterministic generator for the FICTIONAL prototype dataset.
 *   node scripts/generate-mock-data.mjs
 * Output: src/data/mock-*.json
 *
 * Everything here is invented: handles, groups ("Vellani", "Norrin",
 * "Tessarian"), people and .example domains. Nothing refers to real people.
 * Content is written in Indonesian around plausible Indonesian scenarios; these
 * are SIMULATED and are not real events. Real trending news comes from /viral.
 * Observed fields only — sentiment / risk are computed by the analysis engine.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "src", "data");

// ---------------------------------------------------------------- utilities
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rnd = mulberry32(20260917);
const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
const int = (a, b) => a + Math.floor(rnd() * (b - a + 1));
const shuffle = (arr) => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};
const pad = (n, w = 3) => String(n).padStart(w, "0");
const ANCHOR = Date.parse("2026-09-19T05:00:00Z");
const HOUR = 3600e3;
const DAY = 24 * HOUR;
const iso = (ms) => new Date(ms).toISOString().replace(/\.\d+Z$/, "Z");
const write = (name, data) =>
  fs.writeFileSync(path.join(OUT, name), JSON.stringify(data, null, 1) + "\n");

// ----------------------------------------------------------------- accounts
const ADJ = ["tenang", "sigap", "cerdas", "lantang", "bijak", "sejuk", "terang", "gesit", "santun", "mandiri", "lugas", "cermat"];
const NOUN = ["sungai", "suara", "kabar", "warga", "pantau", "pelita", "jembatan", "lentera", "nusa", "forum", "cakrawala", "ladang"];
const usedHandles = new Set();
const uniqueBase = () => {
  for (;;) {
    const b = `${pick(ADJ)}_${pick(NOUN)}_${int(10, 99)}`;
    if (!usedHandles.has(b)) return usedHandles.add(b), b;
  }
};
const handleFor = (platform, base) =>
  platform === "facebook" ? base.replace(/_/g, ".") + ".page"
  : platform === "reddit" ? `u/${base}`
  : platform === "news" ? base.replace(/_/g, "-") + ".example"
  : `@${base}`;
const title = (s) => s.split("_").slice(0, 2).map((w) => w[0].toUpperCase() + w.slice(1)).join(" ");

const PLAT_POOL = ["x", "x", "x", "x", "x", "x", "facebook", "facebook", "facebook", "instagram", "instagram", "tiktok", "tiktok", "youtube", "reddit", "telegram", "telegram"];
const ARCH = [
  ...Array(30).fill("organic"),
  ...Array(5).fill("media"),
  ...Array(8).fill("amplifier"),
  ...Array(5).fill("agitator"),
  ...Array(2).fill("impersonator"),
];
const accounts = [];
const archOf = {};
ARCH.forEach((arch, i) => {
  const id = `ACC-${pad(i + 1)}`;
  const platform = arch === "media" ? (i % 2 ? "news" : "youtube") : arch === "amplifier" || arch === "agitator" ? pick(["x", "x", "telegram", "tiktok"]) : arch === "impersonator" ? "x" : pick(PLAT_POOL);
  const base = uniqueBase();
  const ageDays = { organic: int(400, 2200), media: int(1500, 4000), amplifier: int(8, 70), agitator: int(120, 700), impersonator: int(5, 25) }[arch];
  const a = {
    id, platform, handle: handleFor(platform, base), displayName: title(base),
    createdAt: iso(ANCHOR - ageDays * DAY),
    followers: 0, following: 0, verified: false,
    postsPerDay: 0, profileCompleteness: 0, contentRepetition: 0, activitySpike: false,
  };
  if (arch === "organic") Object.assign(a, { followers: int(200, 18000), following: int(60, 1400), postsPerDay: +(0.2 + rnd() * 3.5).toFixed(1), profileCompleteness: int(70, 100), contentRepetition: +(rnd() * 0.12).toFixed(2) });
  if (arch === "media") Object.assign(a, { followers: int(30000, 400000), following: int(5, 300), postsPerDay: +(3 + rnd() * 9).toFixed(1), profileCompleteness: 100, contentRepetition: +(rnd() * 0.05).toFixed(2), verified: true });
  if (arch === "amplifier") Object.assign(a, { followers: int(15, 300), following: int(1500, 4800), postsPerDay: +(22 + rnd() * 60).toFixed(1), profileCompleteness: int(10, 40), contentRepetition: +(0.6 + rnd() * 0.35).toFixed(2), activitySpike: true });
  if (arch === "agitator") Object.assign(a, { followers: int(2000, 25000), following: int(100, 900), postsPerDay: +(6 + rnd() * 10).toFixed(1), profileCompleteness: int(55, 85), contentRepetition: +(0.15 + rnd() * 0.2).toFixed(2), activitySpike: rnd() > 0.5 });
  if (arch === "impersonator") Object.assign(a, { followers: int(30, 200), following: int(900, 2500), postsPerDay: +(4 + rnd() * 6).toFixed(1), profileCompleteness: int(35, 55), contentRepetition: +(0.5 + rnd() * 0.3).toFixed(2), activitySpike: true });
  if (arch === "impersonator") a.displayName = i % 2 ? "Layanan Pelanggan Bank Contoh (Resmi)" : "Pusat Bantuan Instansi Contoh Resmi";
  accounts.push(a);
  archOf[id] = arch;
});
const byArch = (k) => accounts.filter((a) => archOf[a.id] === k);
const acc = (id) => accounts.find((a) => a.id === id);

// -------------------------------------------------------------------- issues
const GROUPS = ["Vellani", "Norrin", "Tessarian"];
const ISSUE_DEFS = [
  // [kind, title, hashtag, platforms, topic phrase used inside post text (defaults to the lower-cased title)]
  ["neutral", "Jadwal operasional transportasi umum", "#JadwalTransportasi", ["x", "facebook"]],
  ["neutral", "Perpanjangan jam layanan perpustakaan daerah", "#JamPerpustakaan", ["facebook", "instagram"]],
  ["neutral", "Peringatan cuaca ekstrem di wilayah pesisir", "#CuacaPesisir", ["x", "news"]],
  ["neutral", "Konsultasi publik anggaran daerah", "#AnggaranDaerah", ["facebook", "reddit"]],
  ["neutral", "Kalender akademik tahun ajaran baru", "#TahunAjaranBaru", ["facebook", "youtube"]],
  ["positive", "Gerakan kerja bakti bersih sungai", "#KerjaBakti", ["instagram", "facebook"]],
  ["positive", "Peresmian gedung baru puskesmas", "#GedungBaruPuskesmas", ["facebook", "x"]],
  ["positive", "Hasil olimpiade sains pelajar", "#OlimpiadeSains", ["youtube", "instagram", "tiktok"]],
  ["controversy", "Polemik kenaikan tarif angkutan umum", "#TarifAngkutan", ["x", "facebook"]],
  ["controversy", "Perubahan biaya layanan ojek daring", "#BiayaOjekDaring", ["x", "reddit"]],
  ["controversy", "Keterlambatan pembangunan stadion daerah", "#StadionTerlambat", ["x", "facebook", "youtube"]],
  ["controversy", "Keluhan tagihan air PDAM", "#TagihanAir", ["facebook", "x"]],
  ["controversy", "Kenaikan harga bahan pokok di pasar", "#HargaPokokNaik", ["x", "tiktok"]],
  ["controversy", "Aturan parkir baru di pusat kota", "#AturanParkir", ["facebook", "reddit"]],
  ["rumor", "Klaim viral kelangkaan beras (belum terverifikasi)", "#IsuBeras", ["telegram", "x", "tiktok"], "kelangkaan beras"],
  ["rumor", "Klaim viral pelepasan air bendungan (belum terverifikasi)", "#IsuBendungan", ["x", "telegram"], "pelepasan air bendungan secara diam-diam"],
  ["rumor", "Klaim viral penarikan batch vaksin (belum terverifikasi)", "#IsuVaksin", ["telegram", "tiktok", "x"], "penarikan batch vaksin"],
  ["agitation", "Ujaran bermuatan kebencian terhadap kelompok Vellani (fiktif)", "#TolakVellani", ["x", "telegram"]],
  ["agitation", "Provokasi terhadap kelompok Norrin (fiktif)", "#KotaKitaDuluan", ["x", "tiktok"]],
  ["defamation", "Tuduhan terhadap seorang pejabat daerah (fiktif)", "#PejabatDiduga", ["x", "facebook"]],
];
const issues = ISSUE_DEFS.map(([kind, t, tag, platforms, topic], i) => {
  const hot = kind === "rumor" || kind === "agitation";
  const volume = hot ? int(6000, 21000) : kind === "controversy" ? int(3000, 14000) : int(700, 4200);
  const growth = hot ? int(80, 260) : kind === "controversy" ? int(15, 120) : int(-12, 30);
  const daysOld = hot ? int(1, 3) : int(5, 13);
  const w = Array.from({ length: 7 }, (_, d) => (hot ? 0.3 + d * 0.5 : 1 + rnd() * 0.4) * (0.6 + rnd() * 0.8));
  const sum = w.reduce((s, x) => s + x, 0);
  const series = w.map((x) => Math.round((x / sum) * volume));
  const status = hot || (kind === "controversy" && i % 2 === 0) ? "active" : kind === "positive" && i % 2 ? "closed" : "monitoring";
  return {
    id: `ISS-${pad(i + 1)}`, title: t, hashtag: tag, platforms, volume, growth, series, status,
    firstDetectedAt: iso(ANCHOR - daysOld * DAY), lastUpdatedAt: iso(ANCHOR - int(0, 5) * HOUR),
    _kind: kind,
    _topic: topic ?? t.toLowerCase(),
  };
});

// --------------------------------------------------------------------- posts
const T = {
  neutral: [
    "Informasi terbaru: {topic}. Jadwal lengkap sudah diumumkan untuk pekan ini. {tags}",
    "Ringkasan diskusi hari ini tentang {topic}, menurut laporan resmi yang dipublikasikan. {tags}",
    "Pembaruan terkait {topic}: pengumuman resmi sudah tersedia. {tags}",
    "Bagaimana pendapat warga tentang {topic}? Mari berdiskusi dengan santun. {tags}",
  ],
  positive: [
    "Kerja bagus untuk semua tim yang terlibat dalam {topic}, terima kasih atas dukungannya! {tags}",
    "Bangga dengan kerja sama warga dalam {topic}. Hasilnya luar biasa! {tags}",
    "Terima kasih semuanya, {topic} berjalan lancar dan sukses. {tags}",
    "Kabar baik tentang {topic}, sangat bermanfaat bagi banyak orang. {tags}",
  ],
  controversy: [
    "Penanganan {topic} sangat buruk dan mengecewakan. Tidak bisa diterima. {tags}",
    "Saya marah soal {topic}. Keputusan terburuk, benar-benar gagal. {tags}",
    "Kebijakan soal {topic} benar-benar mengecewakan, warga jadi susah. {tags}",
    "Tidak puas dengan {topic}. Ini memalukan, seharusnya bisa lebih baik. {tags}",
    "Pihak yang mengurus {topic} itu bodoh dan hasilnya sampah. {tags}",
  ],
  rumor: [
    "HEBOH: yang tidak mau kamu tahu soal {topic}, ini rekayasa! 100% benar, sebarkan sebelum dihapus! {tags}",
    "Dokumen rahasia membuktikan {topic} sudah direncanakan sejak awal. Bangun dan viralkan ke semua orang! {tags}",
    "Katanya {topic} ternyata rekayasa, viralkan sebelum dihapus! {tags}",
  ],
  agitation: [
    "Orang-orang {group} itu hama. Menjijikkan, usir mereka dari kota kita. {tags}",
    "Semua {group} itu parasit dan harus diusir. {tags}",
    "Kaum {group} itu binatang kotor. Pergi dari sini! {tags}",
  ],
  defamation: [
    "Pak Ardan Velmora itu koruptor dan penipu, dia menggelapkan dana warga. Semua orang tahu. {tags}",
    "Bu Marta Ilvessa pembohong dan mencuri uang amal, tidak perlu bukti. {tags}",
    "Koruptor Pak Ardan Velmora, penipu yang menggelapkan dana warga. {tags}",
  ],
  harassment: [
    "{target} kamu bodoh dan tolol, tidak ada yang suka sama kamu. Diam saja. {tags}",
    "{target} dasar bodoh, kamu tolol. Diam saja. {tags}",
  ],
  spam: [
    "GRATIS followers!!! Klik di sini http://promo-hemat.example/a http://promo-hemat.example/b beli sekarang #promo #gratis #menang #diskon #hadiah #giveaway",
    "Gabung sekarang!!! Hubungi DM untuk promo, link di bio http://promo-hemat.example/c #promo #gratis #menang #diskon #hadiah #giveaway",
  ],
  impersonation: [
    "Pemberitahuan resmi: verifikasi akun Anda sekarang di http://verifikasi-layanan.example/masuk agar tidak diblokir. #layanan",
    "Kami dari tim resmi, klik http://verifikasi-layanan.example/akun untuk verifikasi akun Anda. #layanan",
  ],
};
const MEDIA = ["text", "text", "text", "image", "image", "video", "link"];
const fill = (tpl, o) => tpl.replace(/\{(\w+)\}/g, (_, k) => o[k] ?? "");

const posts = [];
const postKind = {};
const claims = [];
const claimTexts = {};
let claimSeq = 0;
function addPost({ authorId, text, kind, issue, at, claimId = null, hot = 1, mentions = [], extraTags = [] }) {
  const author = acc(authorId);
  const id = `POST-${pad(posts.length + 1)}`;
  const tags = [issue?.hashtag, ...extraTags].filter(Boolean);
  const reach = Math.max(author.followers, 300);
  const views = Math.round(reach * (0.3 + rnd() * 1.6) * hot);
  const likes = Math.round(views * (0.01 + rnd() * 0.06) * (kind === "positive" ? 1.4 : 1));
  const shares = Math.round(views * (0.002 + rnd() * 0.02) * (kind === "rumor" ? 2.5 : 1));
  const comments = Math.round(views * (0.001 + rnd() * 0.01) * (kind === "agitation" || kind === "controversy" ? 1.6 : 1));
  posts.push({
    id, platform: author.platform, url: `mock://${author.platform}/${id}`, authorId, text,
    mediaType: kind === "spam" || kind === "impersonation" ? "link" : pick(MEDIA),
    hashtags: tags, mentions, issueId: issue?.id ?? null, claimId,
    createdAt: iso(at), likes, comments, shares, views,
    status: kind === "neutral" || kind === "positive" ? pick(["new", "reviewed", "reviewed"]) : pick(["needs_review", "needs_review", "new"]),
  });
  postKind[id] = kind;
  return id;
}
const organic = byArch("organic"), media = byArch("media"), amps = byArch("amplifier"), agits = byArch("agitator"), imps = byArch("impersonator");
const someMention = () => (rnd() < 0.3 ? [pick(accounts).handle] : []);
const slotTime = (issue, hot = false) => ANCHOR - (hot ? int(1, 40) * HOUR : int(2, 13 * 24) * HOUR);

for (const issue of issues) {
  const kind = issue._kind;
  const topic = issue._topic;
  const tagStr = issue.hashtag;
  if (kind === "neutral" || kind === "positive") {
    for (let n = 0; n < 3; n++) {
      const author = pick(rnd() < 0.5 ? media : organic);
      addPost({ authorId: author.id, kind, issue, at: slotTime(issue), text: fill(pick(T[kind]), { topic, tags: tagStr }), mentions: someMention() });
    }
  } else if (kind === "controversy") {
    for (let n = 0; n < 5; n++) {
      addPost({ authorId: pick(organic).id, kind, issue, at: slotTime(issue), text: fill(pick(T.controversy), { topic, tags: tagStr }), hot: 1.6, mentions: someMention() });
    }
  } else if (kind === "rumor") {
    const cid = `CLM-${pad(++claimSeq)}`;
    const base = fill(pick(T.rumor), { topic, tags: tagStr });
    claimTexts[cid] = topic;
    const seed = addPost({ authorId: pick(agits).id, kind, issue, at: ANCHOR - int(20, 40) * HOUR, text: base, claimId: cid, hot: 2.2 });
    claims.push({ id: cid, extractedFromPostId: seed, text: `Klaim: ${topic} adalah rekayasa / tidak sesuai pernyataan resmi.` });
    const t0 = ANCHOR - int(10, 18) * HOUR;
    shuffle(amps).slice(0, 5).forEach((a, k) => {
      addPost({ authorId: a.id, kind, issue, at: t0 + k * int(8, 25) * 60e3, text: base + pick(["", " 🔥", " RT!", " #wakeup"]), claimId: cid, hot: 1.2, extraTags: ["#wakeup"].slice(0, k % 2) });
    });
    addPost({ authorId: pick(organic).id, kind: "neutral", issue, at: ANCHOR - int(2, 9) * HOUR, text: `Adakah yang sudah melihat sumber resmi untuk klaim soal ${topic}? ${tagStr}`, claimId: cid });
  } else if (kind === "agitation") {
    for (let n = 0; n < 4; n++) {
      const a = agits[n % agits.length];
      addPost({ authorId: a.id, kind, issue, at: slotTime(issue, true), text: fill(pick(T.agitation), { group: pick(GROUPS), tags: tagStr }), hot: 1.8 });
    }
    const victim = pick(organic);
    addPost({ authorId: agits[0].id, kind: "harassment", issue, at: ANCHOR - int(3, 20) * HOUR, text: fill(pick(T.harassment), { target: victim.handle, tags: tagStr }), mentions: [victim.handle], hot: 1.2 });
  } else if (kind === "defamation") {
    const cid = `CLM-${pad(++claimSeq)}`;
    claimTexts[cid] = "allegation";
    const ids = [0, 1, 2].map((n) => addPost({ authorId: agits[n % agits.length].id, kind, issue, at: slotTime(issue, true), text: T.defamation[n % 3] + " " + tagStr, claimId: n === 0 ? cid : null, hot: 1.5 }));
    claims.push({ id: cid, extractedFromPostId: ids[0], text: "Klaim: seorang pejabat daerah menggelapkan dana warga." });
  }
}
// spam + impersonation + general filler up to 100 posts
for (let n = 0; n < 4; n++) addPost({ authorId: amps[(n + 5) % amps.length].id, kind: "spam", issue: null, at: slotTime(null, true), text: T.spam[n % 2], hot: 0.8 });
imps.forEach((a, n) => { for (let k = 0; k < 2; k++) addPost({ authorId: a.id, kind: "impersonation", issue: null, at: slotTime(null, true), text: T.impersonation[(n + k) % 2], hot: 1 }); });
while (posts.length < 100) {
  const a = pick(organic.concat(media));
  addPost({ authorId: a.id, kind: "neutral", issue: null, at: slotTime(null), text: fill(pick(T.neutral), { topic: "the weekend market", tags: "#WeekendMarket" }), mentions: someMention() });
}
posts.length = 100;

// -------------------------------------------------------------------- claims
const factcheck = (slug) => `https://cekfakta.example/${slug}`;
const ASSESS = {
  "CLM-001": ["likely_false", 0.82, ["Tidak ditemukan sumber resmi yang menyebut adanya kelangkaan.", "Data stok instansi regional menunjukkan level normal."], "USR-003"],
  "CLM-002": ["disputed", 0.6, ["Dua media melaporkan angka yang saling bertentangan.", "Pernyataan instansi masih ditunggu."], "USR-003"],
  "CLM-003": ["unverified", 0.5, ["Belum ditemukan sumber primer."], null],
  "CLM-004": ["unverified", 0.45, ["Tuduhan diulang di banyak postingan; belum ditemukan catatan pengadilan atau laporan resmi."], "USR-003"],
};
const claimsOut = claims.map((c) => {
  const a = ASSESS[c.id];
  return {
    ...c,
    assessment: a ? {
      id: `ASM-${c.id.slice(4)}`, claimId: c.id, verdict: a[0], confidence: a[1], evidence: a[2],
      sources: [
        { name: "Meja Cek Fakta Contoh", url: factcheck(c.id.toLowerCase()), reliability: "medium" },
        { name: "Buletin Instansi Regional Contoh", url: `https://instansi.example/buletin/${c.id.toLowerCase()}`, reliability: "high" },
      ],
      assessedAt: iso(ANCHOR - int(1, 30) * HOUR), reviewer: a[3],
    } : null,
  };
});

// ------------------------------------------------------------------ comments
const C = {
  positive: ["Terima kasih infonya, sangat membantu.", "Postingan bagus, setuju sekali!", "Mantap, semoga lancar terus.", "Suka dengan pembaruan ini, luar biasa."],
  neutral: ["Boleh minta sumbernya?", "Ada pembaruan lagi soal ini?", "Oke, dicatat.", "Kapan jadwal resminya keluar?", "Menarik, saya ikuti terus."],
  negative: ["Ini kabar buruk sekali.", "Sangat mengecewakan, saya benci kebijakan ini.", "Buruk sekali pelayanannya.", "Gagal total, memalukan."],
  hate: ["Orang-orang {group} itu hama.", "Pergi dari sini, {group} kotor, usir saja."],
  harass: ["Kamu bodoh sekali.", "Diam saja, tidak ada yang suka sama kamu.", "Dasar bodoh, kamu tolol."],
  spam: ["GRATIS followers klik di sini http://promo-hemat.example/x beli sekarang", "Hubungi DM untuk promo!!! gabung sekarang"],
  threat: ["Awas kamu, tunggu saja akibatnya, kuhabisi.", "Kamu akan menyesal, awas kamu."],
  other: ["👍", "...", "wkwk"],
};
const MIX = {
  neutral: { positive: 0.25, neutral: 0.55, negative: 0.1, other: 0.1 },
  positive: { positive: 0.6, neutral: 0.25, negative: 0.05, other: 0.1 },
  controversy: { negative: 0.5, neutral: 0.2, harass: 0.1, threat: 0.05, positive: 0.05, other: 0.1 },
  rumor: { neutral: 0.3, negative: 0.15, spam: 0.15, positive: 0.25, harass: 0.05, other: 0.1 },
  agitation: { hate: 0.25, harass: 0.15, negative: 0.15, threat: 0.1, neutral: 0.25, other: 0.1 },
  defamation: { negative: 0.3, harass: 0.25, neutral: 0.25, threat: 0.1, other: 0.1 },
  harassment: { harass: 0.4, neutral: 0.3, negative: 0.2, other: 0.1 },
  spam: { spam: 0.6, other: 0.4 },
  impersonation: { neutral: 0.5, negative: 0.3, other: 0.2 },
};
const pickWeighted = (mix) => {
  let r = rnd(), last;
  for (const [k, w] of Object.entries(mix)) { last = k; if ((r -= w) <= 0) return k; }
  return last;
};
const totalC = posts.reduce((s, p) => s + p.comments + 1, 0);
const comments = [];
posts.forEach((p) => {
  const n = Math.max(1, Math.round(((p.comments + 1) / totalC) * 500));
  for (let k = 0; k < n && comments.length < 500; k++) {
    const cat = pickWeighted(MIX[postKind[p.id]] ?? MIX.neutral);
    const commenter = cat === "spam" ? pick(amps) : cat === "hate" || cat === "harass" || cat === "threat" ? pick(rnd() < 0.5 ? agits : organic) : pick(accounts);
    comments.push({
      id: `CMT-${pad(comments.length + 1)}`, postId: p.id, authorId: commenter.id,
      text: fill(pick(C[cat]), { group: pick(GROUPS) }),
      createdAt: iso(Date.parse(p.createdAt) + int(2, 600) * 60e3),
    });
  }
});
while (comments.length < 500) {
  const p = pick(posts);
  comments.push({ id: `CMT-${pad(comments.length + 1)}`, postId: p.id, authorId: pick(accounts).id, text: pick(C.neutral), createdAt: iso(Date.parse(p.createdAt) + int(2, 600) * 60e3) });
}

// -------------------------------------------------------------- interactions
const cluster = {};
accounts.forEach((a, i) => (cluster[a.id] = archOf[a.id] === "amplifier" ? 9 : archOf[a.id] === "agitator" ? 8 : i % 4));
const postsBy = (id) => posts.filter((p) => p.authorId === id);
const interactions = [];
const addInter = (s, t, type, postId) => {
  if (s === t) return;
  interactions.push({ id: `INT-${pad(interactions.length + 1)}`, type, sourceAccountId: s, targetAccountId: t, postId: postId ?? null, createdAt: iso(ANCHOR - int(1, 12 * 24) * HOUR) });
};
const linkOne = (s, t) => {
  const r = rnd(), tp = postsBy(t);
  const type = r < 0.45 ? "share" : r < 0.65 ? "quote" : "interaction";
  addInter(s, t, type, type !== "interaction" && tp.length ? pick(tp).id : null);
};
for (let n = 0; n < 150; n++) {
  const s = pick(accounts);
  const same = accounts.filter((a) => cluster[a.id] === cluster[s.id] && a.id !== s.id);
  const t = rnd() < 0.72 && same.length ? pick(same) : pick(accounts);
  linkOne(s.id, t.id);
}
amps.forEach((a) => { // amplifiers boost each other and the agitators
  amps.forEach((b) => a.id !== b.id && rnd() < 0.7 && addInter(a.id, b.id, "interaction", null));
  addInter(a.id, agits[0].id, "share", postsBy(agits[0].id)[0]?.id ?? null);
});
agits.forEach((a) => agits.forEach((b) => a.id !== b.id && rnd() < 0.5 && addInter(a.id, b.id, "quote", postsBy(b.id)[0]?.id ?? null)));
shuffle(organic).slice(0, 8).forEach((o) => addInter(o.id, media[0].id, "share", postsBy(media[0].id)[0]?.id ?? null));

// --------------------------------------------------------------------- cases
const firstOf = (k, n = 3) => posts.filter((p) => postKind[p.id] === k).slice(0, n);
const rumorIssues = issues.filter((i) => i._kind === "rumor");
const CAT_ID = { "Platform Manipulation": "Manipulasi Platform", "Hate Speech": "Ujaran Kebencian", Harassment: "Pelecehan", Impersonation: "Peniruan Identitas", Spam: "Spam", Misinformation: "Misinformasi", Other: "Lainnya" };
const STATUS_ID = { INVESTIGATING: "Diselidiki", NEEDS_REVIEW: "Perlu ditinjau", VERIFIED: "Terverifikasi", REPORTED: "Sudah dilaporkan", CLOSED: "Ditutup", OPEN: "Terbuka" };
const caseDefs = [
  ["Amplifikasi terkoordinasi klaim kelangkaan beras", "Platform Manipulation", "x", "high", "INVESTIGATING", posts.filter((p) => p.issueId === rumorIssues[0].id).slice(0, 5)],
  ["Ujaran merendahkan yang menyasar kelompok fiktif", "Hate Speech", "x", "critical", "NEEDS_REVIEW", firstOf("agitation")],
  ["Tuduhan tanpa sumber terhadap seorang pejabat daerah", "Harassment", "x", "medium", "OPEN", firstOf("defamation")],
  ["Akun meniru pusat layanan pelanggan", "Impersonation", "x", "high", "VERIFIED", firstOf("impersonation", 2)],
  ["Spam promosi dengan tautan berantai", "Spam", "x", "low", "REPORTED", firstOf("spam")],
  ["Klaim viral pelepasan air bendungan di kanal Telegram", "Misinformation", "telegram", "high", "INVESTIGATING", posts.filter((p) => p.issueId === rumorIssues[1].id).slice(0, 4)],
  ["Pelecehan terarah di utas balasan", "Harassment", "x", "high", "NEEDS_REVIEW", firstOf("harassment")],
  ["Rumor penarikan batch vaksin di media sosial", "Misinformation", "tiktok", "medium", "OPEN", posts.filter((p) => p.issueId === rumorIssues[2].id).slice(0, 4)],
  ["Tinjauan gelombang keluhan tarif (tidak ditemukan pelanggaran)", "Other", "x", "low", "CLOSED", firstOf("controversy")],
  ["Tinjauan awal halaman komunitas", "Other", "facebook", "low", "CLOSED", firstOf("positive", 2)],
].map(([t, cat, plat, pri, status, ps], i) => {
  const created = ANCHOR - (10 - i) * DAY + int(0, 8) * HOUR;
  const reviewer = ["VERIFIED", "REPORTED", "NEEDS_REVIEW", "CLOSED"].includes(status) ? "USR-003" : null;
  const tl = [{ id: "TL-1", at: iso(created), actorId: "USR-002", type: "CASE_CREATED", message: "Kasus dibuat" }];
  if (status !== "OPEN") tl.push({ id: "TL-2", at: iso(created + 3 * HOUR), actorId: "USR-002", type: "STATUS_CHANGED", message: `Status diubah menjadi ${STATUS_ID.INVESTIGATING}` });
  if (["NEEDS_REVIEW", "VERIFIED", "REPORTED", "CLOSED"].includes(status)) tl.push({ id: "TL-3", at: iso(created + 20 * HOUR), actorId: "USR-002", type: "STATUS_CHANGED", message: `Status diubah menjadi ${STATUS_ID.NEEDS_REVIEW}` });
  if (["VERIFIED", "REPORTED"].includes(status)) tl.push({ id: "TL-4", at: iso(created + 30 * HOUR), actorId: "USR-003", type: "STATUS_CHANGED", message: `Status diubah menjadi ${STATUS_ID.VERIFIED} oleh peninjau` });
  if (status === "REPORTED") tl.push({ id: "TL-5", at: iso(created + 40 * HOUR), actorId: "USR-003", type: "STATUS_CHANGED", message: `Status diubah menjadi ${STATUS_ID.REPORTED}` });
  return {
    id: `CASE-${pad(i + 1, 3)}`, title: t, description: `Kasus prototipe (fiktif). Kategori: ${CAT_ID[cat]}. Semua temuan adalah indikator untuk ditinjau manusia.`,
    platform: plat, category: cat, priority: pri, status, analystId: "USR-002", reviewerId: reviewer,
    createdAt: iso(created), updatedAt: iso(created + (tl.length + 1) * 8 * HOUR),
    postIds: ps.map((p) => p.id), accountIds: [...new Set(ps.map((p) => p.authorId))],
    notes: [{ id: "NOTE-1", authorId: "USR-002", text: "Triase awal selesai. Postingan dikumpulkan dan snapshot disimpan sebagai bukti.", createdAt: iso(created + 2 * HOUR) }],
    timeline: tl,
  };
});

// ------------------------------------------------------------------ evidence
const evidence = [];
caseDefs.slice(0, 7).forEach((c) => {
  c.postIds.slice(0, 2).forEach((pid) => {
    const p = posts.find((x) => x.id === pid);
    evidence.push({
      id: `EVD-${pad(evidence.length + 1)}`, caseId: c.id, url: p.url, postId: pid, accountId: p.authorId,
      capturedAt: iso(Date.parse(c.createdAt) + 2 * HOUR), screenshotRef: null,
      snapshot: {
        postId: pid, accountHandle: acc(p.authorId).handle, platform: p.platform, text: p.text, postedAt: p.createdAt,
        metrics: { likes: p.likes, comments: p.comments, shares: p.shares, views: p.views }, capturedFrom: "mock-dataset",
      },
      source: "mock-dataset", collectedBy: "USR-002",
    });
  });
});

// ------------------------------------------------------------------- reports
const reports = [
  { id: "RPT-001", caseId: "CASE-005", title: "Laporan: spam promosi dengan tautan berantai", status: "submitted", createdBy: "USR-002", approvedBy: "USR-003", reviewerNotes: "Indikator terkonfirmasi pada tinjauan manual.", recommendedAction: "Ajukan melalui halaman pelaporan resmi platform.", submission: { platform: "x", method: "official_page", submittedAt: iso(ANCHOR - 5 * DAY), submittedBy: "USR-003", status: "SUBMITTED" } },
  { id: "RPT-002", caseId: "CASE-004", title: "Laporan: peniruan identitas pusat layanan", status: "approved", createdBy: "USR-002", approvedBy: "USR-003", reviewerNotes: "Nama tampilan menyerupai pusat layanan; akun belum terverifikasi dan baru dibuat.", recommendedAction: "Laporkan melalui formulir peniruan identitas resmi.", submission: null },
  { id: "RPT-003", caseId: "CASE-002", title: "Laporan: ujaran yang menyasar kelompok", status: "in_review", createdBy: "USR-002", approvedBy: null, reviewerNotes: "", recommendedAction: "Menunggu keputusan peninjau.", submission: null },
];

// -------------------------------------------------------------------- write
const stripKind = (issue) => {
  const copy = { ...issue };
  delete copy._kind;
  delete copy._topic;
  return copy;
};
write("mock-accounts.json", accounts);
write("mock-posts.json", posts);
write("mock-comments.json", comments);
write("mock-issues.json", issues.map(stripKind));
write("mock-network.json", interactions);
write("mock-claims.json", claimsOut);
write("mock-cases.json", caseDefs);
write("mock-evidence.json", evidence);
write("mock-reports.json", reports);
console.log(`accounts=${accounts.length} posts=${posts.length} comments=${comments.length} issues=${issues.length} interactions=${interactions.length} claims=${claimsOut.length} cases=${caseDefs.length} evidence=${evidence.length} reports=${reports.length}`);
