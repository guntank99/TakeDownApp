import { createHash } from "node:crypto";

/**
 * Rules for uploaded evidence files. The file type is decided from the file's
 * own bytes ("magic numbers"), never from the name or the type the browser
 * claims, so a script renamed to .png is rejected.
 */

export const MAX_FILE_BYTES = 4 * 1024 * 1024; // stays under common serverless request limits (4.5 MB)

export const FILE_KINDS = {
  "image/png": "gambar",
  "image/jpeg": "gambar",
  "image/gif": "gambar",
  "image/webp": "gambar",
  "video/mp4": "video",
  "video/webm": "video",
  "application/pdf": "dokumen",
  "text/plain": "teks",
} as const;
export type AllowedMime = keyof typeof FILE_KINDS;

export const INLINE_IMAGE_MIMES: readonly string[] = ["image/png", "image/jpeg", "image/gif", "image/webp"];

const startsWith = (b: Uint8Array, sig: number[], at = 0) => sig.every((v, i) => b[at + i] === v);
const ascii = (b: Uint8Array, at: number, text: string) => [...text].every((c, i) => b[at + i] === c.charCodeAt(0));

export function sniffMime(b: Uint8Array): AllowedMime | null {
  if (b.length < 12) return b.length > 0 && isPlainText(b) ? "text/plain" : null;
  if (startsWith(b, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "image/png";
  if (startsWith(b, [0xff, 0xd8, 0xff])) return "image/jpeg";
  if (ascii(b, 0, "GIF87a") || ascii(b, 0, "GIF89a")) return "image/gif";
  if (ascii(b, 0, "RIFF") && ascii(b, 8, "WEBP")) return "image/webp";
  if (ascii(b, 0, "%PDF-")) return "application/pdf";
  if (ascii(b, 4, "ftyp")) return "video/mp4";
  if (startsWith(b, [0x1a, 0x45, 0xdf, 0xa3])) return "video/webm";
  return isPlainText(b) ? "text/plain" : null;
}

/** Valid UTF-8 with no control characters other than tab/newline: safe to treat as text. */
export function isPlainText(b: Uint8Array): boolean {
  try {
    const text = new TextDecoder("utf-8", { fatal: true }).decode(b);
    return !/[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(text);
  } catch {
    return false;
  }
}

export const sha256Hex = (b: Uint8Array): string => createHash("sha256").update(b).digest("hex");

/** Display-safe name: no path parts, no control characters, bounded length. */
export function safeFilename(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? "";
  const clean = base.replace(/[\x00-\x1f\x7f"<>|:*?]/g, "_").replace(/^\.+/, "").trim().slice(0, 120);
  return clean || "berkas";
}

export const formatBytes = (n: number): string => (n < 1024 ? `${n} B` : n < 1024 * 1024 ? `${(n / 1024).toFixed(1)} KB` : `${(n / 1024 / 1024).toFixed(2)} MB`);
