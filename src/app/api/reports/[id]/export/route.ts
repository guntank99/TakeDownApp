import { HttpError, errorJson, withApi } from "@/lib/api/handler";
import { reportToCsv, reportToJson, reportToPdf } from "@/lib/reports/export";
import { getAnalysisContext } from "@/lib/services/analysis";
import { logAudit } from "@/lib/services/audit";
import { getCase } from "@/lib/services/cases";
import { getReport } from "@/lib/services/reports";

/** GET /api/reports/:id/export?format=pdf|csv|json */
export const GET = withApi<{ id: string }>({}, async (req, { user, params }) => {
  const format = req.nextUrl.searchParams.get("format") ?? "json";
  if (!["pdf", "csv", "json"].includes(format)) return errorJson(400, "format must be pdf, csv or json.");

  const report = await getReport(params.id);
  if (!report) throw new HttpError(404, "Report not found.");
  const c = getCase(report.caseId);
  if (!c) throw new HttpError(404, "Case not found.");

  const filename = `${report.id}.${format}`;
  const headers = (type: string) => ({
    "Content-Type": type,
    "Content-Disposition": `attachment; filename="${filename}"`,
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  });
  logAudit({ user, action: "EXPORT_REPORT", object: `${report.id} (${format})`, caseId: c.id });

  if (format === "pdf") {
    const { source } = await getAnalysisContext();
    const bytes = await reportToPdf(report, c, source.isMock);
    return new Response(Buffer.from(bytes), { headers: headers("application/pdf") });
  }
  if (format === "csv") return new Response(reportToCsv(report, c), { headers: headers("text/csv; charset=utf-8") });
  return new Response(reportToJson(report, c), { headers: headers("application/json; charset=utf-8") });
});
