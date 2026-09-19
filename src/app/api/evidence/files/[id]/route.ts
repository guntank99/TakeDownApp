import { HttpError, withApi } from "@/lib/api/handler";
import { INLINE_IMAGE_MIMES } from "@/lib/evidence/files";
import { readEvidenceFile } from "@/lib/services/evidence-files";

/**
 * GET /api/evidence/files/:id[?inline=1]
 * Serves the ORIGINAL bytes after re-checking their SHA-256. A file whose hash
 * no longer matches is refused rather than served as if it were intact.
 * Files download by default; only real images may be shown inline (for the
 * preview), and every response is sandboxed so nothing in a file can run.
 */
export const GET = withApi<{ id: string }>({}, async (req, { params }) => {
  const found = await readEvidenceFile(params.id);
  if (!found) throw new HttpError(404, "Berkas tidak ditemukan.");
  if (!found.intact) throw new HttpError(409, "Integritas berkas gagal: hash tidak cocok dengan yang tercatat saat diunggah.");

  const inline = req.nextUrl.searchParams.get("inline") === "1" && INLINE_IMAGE_MIMES.includes(found.meta.mime);
  const name = found.meta.filename.replace(/[^\x20-\x7E]/g, "_").replace(/"/g, "");
  return new Response(Buffer.from(found.data), {
    headers: {
      "Content-Type": found.meta.mime,
      "Content-Length": String(found.data.length),
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${name}"`,
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "sandbox; default-src 'none'; img-src 'self' data:",
      "Cache-Control": "private, no-store",
      "X-Evidence-SHA256": found.meta.sha256,
    },
  });
});
