import { REPORT_STATUS_LABEL, TAKEDOWN_OUTCOME_LABEL } from "@/lib/i18n/labels";
import type { CaseRecord, EvidenceFileMeta, EvidenceRecord, ReportRecord } from "@/types";

/**
 * REPORT PACKAGE: everything a person needs to file or follow up a report
 * through the platform's official channel, in one document. Pure: the caller
 * supplies the records, so it is easy to test and safe to reuse for export.
 */

export interface PackageInput {
  report: ReportRecord;
  c: CaseRecord;
  /** Public URLs of the case's posts (resolved by the caller). */
  contentUrls: { postId: string; url: string }[];
  evidence: EvidenceRecord[];
  files: EvidenceFileMeta[];
  officialReportUrl: string;
  generatedAt: string;
}

export interface ReportPackage {
  caseId: string;
  reportId: string;
  platform: string;
  contentUrls: { postId: string; url: string }[];
  violationCategory: string;
  reporterStatement: string;
  policyBasis: string[];
  evidenceInventory: { id: string; postId: string | null; capturedAt: string; sha256: string; source: string }[];
  files: { id: string; filename: string; mime: string; size: number; sha256: string; uploadedAt: string }[];
  timeline: { at: string; type: string; message: string }[];
  requestedAction: string;
  submission: { status: string; at: string | null; method: string | null; outcome: string; outcomeNote: string | null } ;
  followUpNotes: string[];
  officialReportUrl: string;
  generatedAt: string;
  notice: string;
}

export function buildPackage(i: PackageInput): ReportPackage {
  const { report, c } = i;
  const policy = report.sections.find((s) => /kebijakan|policy/i.test(s.title));
  return {
    caseId: c.id,
    reportId: report.id,
    platform: c.platform,
    contentUrls: i.contentUrls,
    violationCategory: c.category,
    reporterStatement: report.reviewerNotes.trim() || "(belum diisi)",
    policyBasis: policy?.body ?? ["(belum ada kecocokan kebijakan; verifikasi ke sumber resmi platform)"],
    evidenceInventory: i.evidence.map((e) => ({ id: e.id, postId: e.postId, capturedAt: e.capturedAt, sha256: e.hash, source: e.source })),
    files: i.files.map((f) => ({ id: f.id, filename: f.filename, mime: f.mime, size: f.size, sha256: f.sha256, uploadedAt: f.uploadedAt })),
    timeline: c.timeline.map((t) => ({ at: t.at, type: t.type, message: t.message })),
    requestedAction: report.recommendedAction.trim() || "(belum diisi)",
    submission: {
      status: REPORT_STATUS_LABEL[report.status],
      at: report.submission?.submittedAt ?? null,
      method: report.submission ? (report.submission.method === "official_page" ? "halaman pelaporan resmi (diajukan manual)" : "API resmi") : null,
      outcome: report.submission ? TAKEDOWN_OUTCOME_LABEL[report.submission.outcome ?? "pending"] : "belum diajukan",
      outcomeNote: report.submission?.outcomeNote ?? null,
    },
    followUpNotes: c.notes.map((n) => n.text),
    officialReportUrl: i.officialReportUrl,
    generatedAt: i.generatedAt,
    notice: "Ini permintaan peninjauan (take down request), bukan jaminan penghapusan. Keputusan ada pada platform. Indikator otomatis memerlukan tinjauan manusia.",
  };
}

const esc = (s: string) => s.replace(/\r?\n/g, " ").replace(/\|/g, "\\|");

export function packageToMarkdown(p: ReportPackage): string {
  const lines: string[] = [
    `# Paket Laporan ${p.reportId}`,
    "",
    `> ${p.notice}`,
    "",
    "| | |",
    "|---|---|",
    `| Kasus | ${p.caseId} |`,
    `| Platform | ${p.platform} |`,
    `| Kategori dugaan pelanggaran | ${esc(p.violationCategory)} |`,
    `| Dibuat | ${p.generatedAt} |`,
    `| Kanal pelaporan resmi | ${p.officialReportUrl || "(tidak tersedia)"} |`,
    "",
    "## Konten yang dilaporkan",
    ...(p.contentUrls.length ? p.contentUrls.map((u) => `- ${u.postId}: ${u.url}`) : ["- (tidak ada)"]),
    "",
    "## Pernyataan pelapor",
    p.reporterStatement,
    "",
    "## Dasar kebijakan (dugaan; verifikasi ke sumber resmi)",
    ...p.policyBasis.map((l) => `- ${l}`),
    "",
    "## Inventaris bukti",
    ...(p.evidenceInventory.length
      ? ["| ID | Postingan | Diambil | SHA-256 | Sumber |", "|---|---|---|---|---|", ...p.evidenceInventory.map((e) => `| ${e.id} | ${e.postId ?? "—"} | ${e.capturedAt} | \`${e.sha256}\` | ${esc(e.source)} |`)]
      : ["(belum ada bukti)"]),
    "",
    "## Berkas bukti",
    ...(p.files.length
      ? ["| ID | Nama | Jenis | Ukuran (B) | SHA-256 |", "|---|---|---|---:|---|", ...p.files.map((f) => `| ${f.id} | ${esc(f.filename)} | ${f.mime} | ${f.size} | \`${f.sha256}\` |`)]
      : ["(tidak ada berkas)"]),
    "",
    "## Lini masa",
    ...(p.timeline.length ? ["| Waktu | Peristiwa | Keterangan |", "|---|---|---|", ...p.timeline.map((t) => `| ${t.at} | ${t.type} | ${esc(t.message)} |`)] : ["(kosong)"]),
    "",
    "## Tindakan yang diminta",
    p.requestedAction,
    "",
    "## Catatan pengajuan",
    `- Status laporan: ${p.submission.status}`,
    `- Diajukan: ${p.submission.at ?? "belum"}${p.submission.method ? ` melalui ${p.submission.method}` : ""}`,
    `- Hasil dari platform: ${p.submission.outcome}${p.submission.outcomeNote ? ` (${esc(p.submission.outcomeNote)})` : ""}`,
    "",
    "## Catatan tindak lanjut",
    ...(p.followUpNotes.length ? p.followUpNotes.map((n) => `- ${esc(n)}`) : ["- (tidak ada)"]),
    "",
  ];
  return lines.join("\n");
}
