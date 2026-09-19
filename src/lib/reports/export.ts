import { PDFDocument, StandardFonts, rgb, type PDFFont } from "pdf-lib";
import { REPORT_STATUS_LABEL } from "@/lib/i18n/labels";
import type { CaseRecord, ReportRecord } from "@/types";

/** Ordered list of (heading, lines) including the editable closing sections. */
function allSections(report: ReportRecord) {
  return [
    ...report.sections.map((s) => ({ title: s.title, lines: s.body })),
    { title: "Catatan Peninjau", lines: [report.reviewerNotes.trim() || "Belum ada catatan peninjau."] },
    { title: "Rekomendasi Tindakan Berikutnya", lines: [report.recommendedAction.trim() || "Belum ada."] },
  ];
}

function metaLines(report: ReportRecord, c: CaseRecord): [string, string][] {
  return [
    ["ID Laporan", report.id],
    ["ID Kasus", c.id],
    ["Judul", report.title],
    ["Status", REPORT_STATUS_LABEL[report.status]],
    ["Dibuat", report.createdAt],
    ["Dibuat oleh", report.createdBy],
    ["Disetujui oleh", report.approvedBy ?? "—"],
    ...(report.submission
      ? ([["Diajukan", `${report.submission.submittedAt} melalui ${report.submission.method === "official_page" ? "halaman pelaporan resmi" : "API resmi"} (${report.submission.platform})`]] as [string, string][])
      : []),
  ];
}

export function reportToJson(report: ReportRecord, c: CaseRecord): string {
  return JSON.stringify(
    {
      report: { ...report, sections: undefined },
      case: { id: c.id, title: c.title, platform: c.platform, category: c.category, priority: c.priority, status: c.status },
      sections: allSections(report).map((s) => ({ title: s.title, lines: s.lines })),
      disclaimer: "Indikator otomatis memerlukan tinjauan manusia dan bukan temuan bahwa telah terjadi pelanggaran.",
    },
    null,
    2,
  );
}

/** Neutralises spreadsheet formula injection and quotes fields for CSV. */
export function csvCell(value: string): string {
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

export function reportToCsv(report: ReportRecord, c: CaseRecord): string {
  const rows: string[][] = [["bagian", "butir"]];
  for (const [k, v] of metaLines(report, c)) rows.push(["Laporan", `${k}: ${v}`]);
  for (const s of allSections(report)) for (const line of s.lines) rows.push([s.title, line]);
  return rows.map((r) => r.map(csvCell).join(",")).join("\r\n") + "\r\n";
}

// ---------------------------------------------------------------- PDF

/** Standard PDF fonts only cover WinAnsi; anything else becomes "?". */
const toWinAnsi = (s: string) =>
  s.replace(/[\r\t]/g, " ").replace(/[^\n\x20-\x7E\xA0-\xFF]/g, "?");

function wrap(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const out: string[] = [];
  for (const paragraph of text.split("\n")) {
    let line = "";
    for (const word of paragraph.split(" ")) {
      const candidate = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
        line = candidate;
        continue;
      }
      if (line) out.push(line);
      // very long tokens (URLs, hashes) are broken by character
      let rest = word;
      while (font.widthOfTextAtSize(rest, size) > maxWidth) {
        let n = rest.length;
        while (n > 1 && font.widthOfTextAtSize(rest.slice(0, n), size) > maxWidth) n--;
        out.push(rest.slice(0, n));
        rest = rest.slice(n);
      }
      line = rest;
    }
    out.push(line);
  }
  return out;
}

export async function reportToPdf(report: ReportRecord, c: CaseRecord, isMock: boolean): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const [W, H, M] = [595, 842, 50];
  const maxWidth = W - 2 * M;

  let page = pdf.addPage([W, H]);
  let y = H - M;
  const ensure = (needed: number) => {
    if (y - needed < M + 20) {
      page = pdf.addPage([W, H]);
      y = H - M;
    }
  };
  const draw = (text: string, opts: { size?: number; bold?: boolean; color?: [number, number, number]; gap?: number } = {}) => {
    const size = opts.size ?? 10;
    const f = opts.bold ? bold : font;
    for (const line of wrap(toWinAnsi(text), f, size, maxWidth)) {
      ensure(size + 4);
      page.drawText(line, { x: M, y: y - size, size, font: f, color: rgb(...(opts.color ?? [0.1, 0.1, 0.12])) });
      y -= size + 4;
    }
    y -= opts.gap ?? 0;
  };

  draw("THE POWER - Laporan Kasus", { size: 16, bold: true, gap: 4 });
  if (isMock) draw("SUMBER DATA: MOCK / SIMULASI", { size: 9, bold: true, color: [0.7, 0.4, 0], gap: 4 });
  for (const [k, v] of metaLines(report, c)) draw(`${k}: ${v}`, { size: 9, color: [0.3, 0.3, 0.33] });
  y -= 8;

  for (const s of allSections(report)) {
    ensure(40);
    draw(s.title, { size: 12, bold: true, gap: 2 });
    for (const line of s.lines) draw(line, { size: 9.5, gap: 2 });
    y -= 6;
  }
  draw("Indikator otomatis memerlukan tinjauan manusia dan bukan temuan bahwa telah terjadi pelanggaran.", { size: 8, color: [0.4, 0.4, 0.44] });

  const pages = pdf.getPages();
  pages.forEach((p, i) =>
    p.drawText(`${report.id} - halaman ${i + 1} dari ${pages.length}`, { x: M, y: 28, size: 8, font, color: rgb(0.5, 0.5, 0.55) }),
  );
  return pdf.save();
}
