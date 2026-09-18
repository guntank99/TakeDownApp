import { analyzeContent } from "@/lib/analysis/indicators";
import { HttpError, readJson, withApi } from "@/lib/api/handler";
import { logAudit } from "@/lib/services/audit";
import { formatZodError, textSchema } from "@/lib/validation/schemas";

/** POST /api/analysis {text}: content analysis with indicators, confidence, reasons and evidence. */
export const POST = withApi({}, async (req, { user }) => {
  const parsed = textSchema.safeParse(await readJson(req));
  if (!parsed.success) throw new HttpError(400, formatZodError(parsed.error));
  logAudit({ user, action: "ANALYZE_POST", object: `api text (${parsed.data.text.length} chars)` });
  return analyzeContent(parsed.data.text);
});
