/**
 * Report READINESS: is the report complete enough to file? It is NOT a measure
 * of whether a violation happened, and it never decides anything about a
 * person. Two kinds of check:
 *   blocking  - filing is refused until fixed (no evidence, evidence altered,
 *               same content already reported, no reviewer statement)
 *   advisory  - shown as REVIEW so the reviewer can improve the report
 */

export interface ReadinessInput {
  urlCount: number;
  urlsValid: boolean;
  platformKnown: boolean;
  categorySelected: boolean;
  evidenceCount: number;
  evidenceIntact: boolean;
  /** Policy matches suggested for the case's posts. */
  policyMatches: number;
  policyMatchesVerified: number;
  description: string;
  reviewerNotes: string;
  recommendedAction: string;
  /** Id of another report that already covers the same content, if any. */
  duplicateOf: string | null;
}

export type CheckStatus = "PASS" | "REVIEW";
export interface ReadinessCheck {
  key: string;
  label: string;
  status: CheckStatus;
  detail: string;
  blocking: boolean;
}
export interface ReadinessScoreLine {
  label: string;
  score: number;
  max: 20;
}
export interface Readiness {
  checks: ReadinessCheck[];
  score: number;
  lines: ReadinessScoreLine[];
  /** True when no BLOCKING check needs review. */
  ready: boolean;
  blockers: string[];
}

export function assessReadiness(i: ReadinessInput): Readiness {
  const check = (key: string, label: string, pass: boolean, ok: string, fix: string, blocking = false): ReadinessCheck => ({
    key,
    label,
    status: pass ? "PASS" : "REVIEW",
    detail: pass ? ok : fix,
    blocking: blocking && !pass,
  });

  const noteOk = i.reviewerNotes.trim().length > 0;
  const actionOk = i.recommendedAction.trim().length > 0;

  const checks: ReadinessCheck[] = [
    check("url", "URL valid", i.urlCount > 0 && i.urlsValid, `${i.urlCount} tautan valid`, "Lampirkan minimal satu postingan dengan URL yang valid."),
    check("platform", "Platform teridentifikasi", i.platformKnown, "Platform dikenali", "Platform kasus tidak dikenali."),
    check("evidence", "Bukti tersedia", i.evidenceCount > 0, `${i.evidenceCount} bukti tersimpan`, "Ambil bukti (snapshot ber-hash) sebelum melapor.", true),
    check("integrity", "Bukti utuh (hash cocok)", i.evidenceIntact, "Semua hash bukti cocok", "Ada bukti yang hash-nya tidak cocok: isinya berubah setelah diambil.", true),
    check("category", "Kategori dugaan pelanggaran dipilih", i.categorySelected, "Kategori dipilih", "Pilih kategori dugaan pelanggaran pada kasus."),
    check(
      "policy",
      "Dasar kebijakan terverifikasi",
      i.policyMatchesVerified > 0,
      `${i.policyMatchesVerified} kecocokan berbasis aturan yang diverifikasi terhadap sumber resmi`,
      i.policyMatches > 0
        ? "Kecocokan kebijakan ada, tetapi aturannya belum diverifikasi terhadap sumber resmi. Periksa halaman kebijakan resmi platform."
        : "Belum ada kecocokan kebijakan. Pastikan dugaan pelanggaran memang mengacu pada aturan platform.",
    ),
    check("statement", "Pernyataan faktual dan objektif", noteOk && actionOk, "Ada catatan peninjau dan tindakan yang diminta", "Tulis catatan peninjau dan tindakan yang diminta: faktual, singkat, tanpa emosi atau ancaman.", true),
    check("no-fabrication", "Tanpa informasi rekaan", i.evidenceIntact && i.evidenceCount > 0, "Isi laporan berasal dari bukti yang tersimpan", "Isi laporan harus bersumber dari bukti yang tersimpan dan utuh."),
    check("duplicate", "Bukan laporan ganda", i.duplicateOf === null, "Tidak ada laporan lain untuk konten yang sama", `LAPORAN GANDA TERDETEKSI: konten ini sudah dilaporkan di ${i.duplicateOf}. Jangan kirim ulang; catat hasilnya atau tunggu keputusan platform.`, true),
    { key: "authorization", label: "Otorisasi pelapor", status: "PASS", detail: "Dikonfirmasi oleh pengaju pada langkah pengajuan", blocking: false },
  ];

  const lines: ReadinessScoreLine[] = [
    { label: "URL", score: i.urlCount > 0 && i.urlsValid ? 20 : 0, max: 20 },
    { label: "Bukti", score: i.evidenceCount > 0 && i.evidenceIntact ? 20 : 0, max: 20 },
    { label: "Kecocokan kebijakan", score: i.policyMatchesVerified > 0 ? 20 : i.policyMatches > 0 ? 10 : 0, max: 20 },
    { label: "Deskripsi", score: i.description.trim().length >= 30 ? 20 : i.description.trim().length > 0 ? 10 : 0, max: 20 },
    { label: "Pernyataan pelapor", score: noteOk && actionOk ? 20 : noteOk || actionOk ? 10 : 0, max: 20 },
  ];

  const blockers = checks.filter((c) => c.blocking).map((c) => c.detail);
  return { checks, score: lines.reduce((s, l) => s + l.score, 0), lines, ready: blockers.length === 0, blockers };
}
