import type {
  AuditAction,
  CaseStatus,
  ClaimVerdict,
  IssueStatus,
  MediaType,
  PolicyCategory,
  Priority,
  PostStatus,
  ReportStatus,
  ReviewStatus,
  RiskLevel,
  Sentiment,
  Severity,
} from "@/types";

/**
 * Indonesian display labels. Data values (statuses, enums) stay in English in
 * the code, database and API so integrations do not break; only what people
 * read is translated here.
 */

export const SENTIMENT_LABEL: Record<Sentiment, string> = { positive: "Positif", neutral: "Netral", negative: "Negatif" };

export const RISK_LABEL: Record<RiskLevel, string> = { low: "RENDAH", medium: "SEDANG", high: "TINGGI", critical: "KRITIS" };

export const POST_STATUS_LABEL: Record<PostStatus, string> = { new: "Baru", needs_review: "Perlu ditinjau", reviewed: "Sudah ditinjau" };

export const ISSUE_STATUS_LABEL: Record<IssueStatus, string> = { active: "Aktif", monitoring: "Dipantau", closed: "Ditutup" };

export const CASE_STATUS_LABEL: Record<CaseStatus, string> = {
  OPEN: "Terbuka",
  INVESTIGATING: "Diselidiki",
  NEEDS_REVIEW: "Perlu ditinjau",
  VERIFIED: "Terverifikasi",
  REPORTED: "Sudah dilaporkan",
  CLOSED: "Ditutup",
};

export const PRIORITY_LABEL: Record<Priority, string> = { low: "Rendah", medium: "Sedang", high: "Tinggi", critical: "Kritis" };

export const REPORT_STATUS_LABEL: Record<ReportStatus, string> = {
  draft: "Draf",
  in_review: "Dalam peninjauan",
  approved: "Disetujui",
  submitted: "Sudah diajukan",
};

export const REVIEW_STATUS_LABEL: Record<ReviewStatus, string> = {
  NEEDS_HUMAN_REVIEW: "PERLU TINJAUAN MANUSIA",
  NO_INDICATORS: "TIDAK ADA INDIKATOR",
};

export const POLICY_CATEGORY_LABEL: Record<PolicyCategory, string> = {
  "Hate Speech": "Ujaran Kebencian",
  Harassment: "Pelecehan",
  Threats: "Ancaman",
  Violence: "Kekerasan",
  Spam: "Spam",
  Impersonation: "Peniruan Identitas",
  Fraud: "Penipuan",
  Misinformation: "Misinformasi",
  Privacy: "Privasi",
  Copyright: "Hak Cipta",
  "Adult Content": "Konten Dewasa",
  "Platform Manipulation": "Manipulasi Platform",
  Other: "Lainnya",
};

export const SEVERITY_LABEL: Record<Severity, string> = { low: "Rendah", medium: "Sedang", high: "Tinggi" };

export const MEDIA_TYPE_LABEL: Record<MediaType, string> = { text: "Teks", image: "Gambar", video: "Video", link: "Tautan" };

export const CLAIM_VERDICT_LABEL: Record<ClaimVerdict, string> = {
  verified: "Terverifikasi",
  likely_accurate: "Kemungkinan Akurat",
  unverified: "Belum Terverifikasi",
  disputed: "Diperdebatkan",
  likely_false: "Kemungkinan Keliru",
};

export const AUDIT_ACTION_LABEL: Record<AuditAction, string> = {
  LOGIN: "Masuk",
  LOGIN_FAILED: "Gagal masuk",
  LOGOUT: "Keluar",
  CREATE_CASE: "Membuat kasus",
  UPDATE_CASE: "Memperbarui kasus",
  ANALYZE_POST: "Menganalisis teks",
  ANALYZE_ACCOUNT: "Menganalisis akun",
  CREATE_EVIDENCE: "Membuat bukti",
  GENERATE_REPORT: "Membuat laporan",
  UPDATE_REPORT: "Memperbarui laporan",
  EXPORT_REPORT: "Mengekspor laporan",
  SEARCH: "Pencarian",
  SUBMIT_REPORT: "Mencatat pengajuan laporan",
  UPDATE_POLICY: "Memperbarui kebijakan",
};

export const AUDIT_RESULT_LABEL = { SUCCESS: "Berhasil", DENIED: "Ditolak", FAILED: "Gagal" } as const;

export const BOOL_LABEL = (v: boolean) => (v ? "Ya" : "Tidak");
