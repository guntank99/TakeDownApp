import { describe, expect, it } from "vitest";
import { analyzeComment } from "./comments";
import { coordinationPoints, findCoordinatedGroups } from "./coordination";
import { analyzeContent } from "./indicators";
import { analyzeSentiment } from "./sentiment";

describe("analyzeSentiment", () => {
  it("mendeteksi teks positif (Indonesia)", () => {
    const r = analyzeSentiment("Kerja bagus untuk timnya, terima kasih atas dukungannya!");
    expect(r.sentiment).toBe("positive");
    expect(r.keywords).toContain("bagus");
  });

  it("mendeteksi teks negatif (Indonesia dan Inggris)", () => {
    expect(analyzeSentiment("Kebijakan ini buruk dan mengecewakan").sentiment).toBe("negative");
    expect(analyzeSentiment("This is terrible and disappointing").sentiment).toBe("negative");
  });

  it("menangani negasi", () => {
    expect(analyzeSentiment("Pelayanannya tidak bagus").sentiment).toBe("negative");
    expect(analyzeSentiment("Hasilnya gak buruk").sentiment).toBe("positive");
    expect(analyzeSentiment("This is not good").sentiment).toBe("negative");
  });

  it("menghasilkan netral beserta alasan bila tidak ada kata kunci", () => {
    const r = analyzeSentiment("Jadwal dipublikasikan pada hari Senin.");
    expect(r.sentiment).toBe("neutral");
    expect(r.reason).toMatch(/tidak ada kata kunci/i);
  });

  it("menjaga confidence dalam rentang 0.5–0.95", () => {
    const r = analyzeSentiment("buruk jelek parah gagal benci memalukan");
    expect(r.confidence).toBeGreaterThanOrEqual(0.5);
    expect(r.confidence).toBeLessThanOrEqual(0.95);
  });
});

describe("analyzeContent: indikator", () => {
  it("menandai bahasa merendahkan yang menyasar kelompok untuk ditinjau manusia", () => {
    const a = analyzeContent("Orang-orang Vellani itu hama. Menjijikkan, usir mereka dari kota kita.");
    expect(a.indicators.hate_speech.detected).toBe(true);
    expect(a.indicators.hate_speech.confidence).toBeGreaterThanOrEqual(0.5);
    expect(a.status).toBe("NEEDS_HUMAN_REVIEW");
    expect(a.indicators.hate_speech.reason).toMatch(/potensi/i);
  });

  it("tetap mendeteksi contoh berbahasa Inggris", () => {
    const a = analyzeContent("The Vellani are vermin. Disgusting people, drive them out of our city.");
    expect(a.indicators.hate_speech.detected).toBe(true);
  });

  it("tidak menandai pengumuman netral", () => {
    const a = analyzeContent("Informasi terbaru: jadwal lengkap sudah diumumkan untuk pekan ini. #JadwalTransportasi");
    expect(a.flagged).toEqual([]);
    expect(a.status).toBe("NO_INDICATORS");
    expect(a.toxicity).toBe(0);
  });

  it("menghina pihak non-kelompok adalah toksisitas, bukan ujaran kebencian", () => {
    const a = analyzeContent("Pihak yang mengurus ini bodoh dan hasilnya sampah.");
    expect(a.indicators.hate_speech.detected).toBe(false);
    expect(a.toxicity).toBeGreaterThan(0);
  });

  it("mendeteksi ancaman", () => {
    const a = analyzeContent("Awas kamu, tunggu saja akibatnya, kuhabisi.");
    expect(a.indicators.threat.detected).toBe(true);
    expect(a.indicators.threat.evidence.length).toBeGreaterThanOrEqual(2);
    expect(analyzeContent("You will regret this, watch your back.").indicators.threat.detected).toBe(true);
  });

  it("mendeteksi pelecehan yang ditujukan kepada seseorang", () => {
    expect(analyzeContent("@warga_sungai kamu bodoh dan tolol, diam saja.").indicators.harassment.detected).toBe(true);
    expect(analyzeContent("@someone you are a pathetic idiot, shut up.").indicators.harassment.detected).toBe(true);
  });

  it("mendeteksi spam dan peniruan identitas gaya phishing", () => {
    const spam = analyzeContent(
      "GRATIS followers!!! Klik di sini http://promo-hemat.example/a http://promo-hemat.example/b beli sekarang #promo #gratis #menang #diskon #hadiah",
    );
    expect(spam.indicators.spam.detected).toBe(true);
    const phish = analyzeContent("Pemberitahuan resmi: verifikasi akun Anda sekarang di http://verifikasi-layanan.example/masuk agar tidak diblokir.");
    expect(phish.indicators.impersonation.detected).toBe(true);
  });

  it("menandai pola misinformasi tetapi tidak klaim yang menyebut sumber", () => {
    const cue = analyzeContent("HEBOH: yang tidak mau kamu tahu soal ini rekayasa! 100% benar, sebarkan sebelum dihapus!");
    expect(cue.indicators.misinformation.detected).toBe(true);
    expect(cue.indicators.misinformation.reason).toMatch(/bukan temuan/i);
    const sourced = analyzeContent("Menurut laporan resmi yang dipublikasikan, jadwal berubah.");
    expect(sourced.indicators.misinformation.detected).toBe(false);
  });

  it("indikator pencemaran nama baik memerlukan orang yang disebut", () => {
    const named = analyzeContent("Pak Ardan Velmora itu koruptor dan penipu, dia menggelapkan dana warga. Semua orang tahu.");
    expect(named.indicators.defamation.detected).toBe(true);
    expect(named.indicators.defamation.reason).toMatch(/peninjauan manusia \/ hukum/i);
    const unnamed = analyzeContent("Perusahaan itu korup.");
    expect(unnamed.indicators.defamation.detected).toBe(false);
  });

  it("tidak pernah melaporkan confidence di atas 0.95 atau untuk indikator yang tidak terdeteksi", () => {
    const a = analyzeContent("Kaum Vellani itu binatang kotor, parasit. Usir! Pergi dari sini. Diusir semuanya.");
    for (const ind of Object.values(a.indicators)) {
      expect(ind.confidence).toBeLessThanOrEqual(0.95);
      if (!ind.detected) expect(ind.confidence).toBe(0);
    }
  });
});

describe("analyzeComment", () => {
  const cat = (text: string) => analyzeComment({ id: "c", text }).category;
  it("memprioritaskan ancaman > ujaran kebencian > pelecehan > spam > sentimen", () => {
    expect(cat("Kamu akan menyesal, awas kamu.")).toBe("Indikator Ancaman");
    expect(cat("Orang-orang Vellani itu hama.")).toBe("Indikator Ujaran Kebencian");
    expect(cat("Diam saja, tidak ada yang suka sama kamu.")).toBe("Pelecehan");
    expect(cat("Hubungi DM untuk promo!!! gabung sekarang")).toBe("Spam");
    expect(cat("Terima kasih infonya, sangat membantu.")).toBe("Positif");
    expect(cat("Gagal total, memalukan.")).toBe("Negatif");
    expect(cat("Ada pembaruan lagi soal ini?")).toBe("Netral");
    expect(cat("👍")).toBe("Lainnya");
  });
});

describe("findCoordinatedGroups", () => {
  const base = "HEBOH: klaim rahasia soal bendungan. Sebarkan sebelum dihapus!";
  const mk = (id: string, authorId: string, text: string, iso: string) => ({ id, authorId, text, createdAt: iso });

  it("mengelompokkan posting hampir identik dari 3+ akun dalam jendela waktu", () => {
    const groups = findCoordinatedGroups([
      mk("p1", "a1", base, "2026-09-16T10:00:00Z"),
      mk("p2", "a2", base + " RT!", "2026-09-16T10:20:00Z"),
      mk("p3", "a3", base + " #bangun", "2026-09-16T10:40:00Z"),
      mk("p4", "a4", "Resep sayur asem yang enak untuk keluarga", "2026-09-16T10:50:00Z"),
    ]);
    expect(groups.get("p1")?.accounts).toBe(3);
    expect(groups.has("p4")).toBe(false);
  });

  it("mengabaikan pengulangan oleh akun yang sama dan posting di luar jendela waktu", () => {
    expect(
      findCoordinatedGroups([
        mk("p1", "a1", base, "2026-09-16T10:00:00Z"),
        mk("p2", "a1", base, "2026-09-16T10:05:00Z"),
        mk("p3", "a2", base, "2026-09-16T10:10:00Z"),
        mk("p4", "a3", base, "2026-09-20T10:10:00Z"),
      ]).size,
    ).toBe(0);
  });

  it("menskalakan poin koordinasi dengan maksimum 15", () => {
    expect(coordinationPoints(2)).toBe(0);
    expect(coordinationPoints(3)).toBe(8);
    expect(coordinationPoints(5)).toBe(15);
    expect(coordinationPoints(50)).toBe(15);
  });
});
