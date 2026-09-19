import { HttpError, errorJson, withApi } from "@/lib/api/handler";
import { reportToCsv, reportToJson, reportToPdf } from "@/lib/reports/export";
import { buildPackage, packageToMarkdown } from "@/lib/reports/package";
import { getAnalysisContext } from "@/lib/services/analysis";
import { logAudit } from "@/lib/services/audit";
import { getCase } from "@/lib/services/cases";
import { listEvidence } from "@/lib/services/evidence";
import { listCaseFiles } from "@/lib/services/evidence-files";
import { getReport } from "@/lib/services/reports";
import { PLATFORM_REPORTING } from "@/lib/toc/reporting";

const FORMATS = ["pdf", "csv", "json", "md", "package"] as const;

/** GET /api/reports/:id/export?format=pdf|csv|json|md|package  (md/package = full report package) */
export const GET = withApi<{ id: string }>({}, async (req, { user, params }) => {
  const format = req.nextUrl.searchParams.get("format") ?? "json";
  if (!(FORMATS as readonly string[]).includes(format)) return errorJson(400, "format harus pdf, csv, json, md, atau package.");

  const report = await getReport(params.id);
  if (!report) throw new HttpError(404, "Laporan tidak ditemukan.");
  const c = await getCase(report.caseId);
  if (!c) throw new HttpError(404, "Kasus tidak ditemukan.");

  const ext = format === "package" ? "package.json" : format;
  const headers = (type: string) => ({
    "Content-Type": type,
    "Content-Disposition": `attachment; filename="${report.id}.${ext}"`,
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  });
  await logAudit({ user, action: format === "md" || format === "package" ? "EXPORT_PACKAGE" : "EXPORT_REPORT", object: `${report.id} (${format})`, caseId: c.id });

  if (format === "md" || format === "package") {
    const ctx = await getAnalysisContext();
    const pkg = buildPackage({
      report,
      c,
      contentUrls: c.postIds.flatMap((id) => {
        const post = ctx.postById.get(id);
        return post ? [{ postId: id, url: post.url }] : [];
      }),
      evidence: await listEvidence(c.id),
      files: await listCaseFiles(c.id),
      officialReportUrl: PLATFORM_REPORTING[c.platform].officialReportingUrl,
      generatedAt: new Date().toISOString(),
    });
    return format === "md"
      ? new Response(packageToMarkdown(pkg), { headers: headers("text/markdown; charset=utf-8") })
      : new Response(JSON.stringify(pkg, null, 2), { headers: headers("application/json; charset=utf-8") });
  }

  if (format === "pdf") {
    const { source } = await getAnalysisContext();
    const bytes = await reportToPdf(report, c, source.isMock);
    return new Response(Buffer.from(bytes), { headers: headers("application/pdf") });
  }
  if (format === "csv") return new Response(reportToCsv(report, c), { headers: headers("text/csv; charset=utf-8") });
  return new Response(reportToJson(report, c), { headers: headers("application/json; charset=utf-8") });
});
