import { z } from "zod";
import { PLATFORMS } from "@/lib/utils/platforms";

/** Shared by server actions and API route handlers. */

export const POLICY_CATEGORIES = [
  "Hate Speech", "Harassment", "Threats", "Violence", "Spam", "Impersonation", "Fraud",
  "Misinformation", "Privacy", "Copyright", "Adult Content", "Platform Manipulation", "Other",
] as const;
export const CASE_STATUSES = ["OPEN", "INVESTIGATING", "NEEDS_REVIEW", "VERIFIED", "REPORTED", "CLOSED"] as const;
export const PRIORITIES = ["low", "medium", "high", "critical"] as const;
export const REPORT_STATUSES = ["draft", "in_review", "approved"] as const;

const id = (label: string) => z.string().trim().min(1, `${label} wajib diisi`).max(64);
const idList = z.array(z.string().trim().min(1).max(64)).max(50);

export const platformSchema = z.enum(PLATFORMS as [string, ...string[]]);

export const createCaseSchema = z.object({
  title: z.string().trim().min(3, "Judul minimal 3 karakter").max(140),
  description: z.string().trim().max(2000).default(""),
  platform: platformSchema,
  category: z.enum(POLICY_CATEGORIES),
  priority: z.enum(PRIORITIES),
  postIds: idList.default([]),
  accountIds: idList.default([]),
});

export const updateCaseSchema = z
  .object({
    status: z.enum(CASE_STATUSES).optional(),
    priority: z.enum(PRIORITIES).optional(),
    title: z.string().trim().min(3).max(140).optional(),
    description: z.string().trim().max(2000).optional(),
    note: z.string().trim().min(1).max(2000).optional(),
    addPostId: id("Postingan").optional(),
    addAccountId: id("Akun").optional(),
  })
  .refine((v) => Object.values(v).some((x) => x !== undefined), "Tidak ada yang diperbarui");

export const createEvidenceSchema = z.object({
  caseId: id("Kasus"),
  postId: id("Postingan"),
  screenshotRef: z.string().trim().max(300).optional(),
});

export const createReportSchema = z.object({ caseId: id("Kasus") });

export const updateReportSchema = z
  .object({
    status: z.enum(REPORT_STATUSES).optional(),
    reviewerNotes: z.string().trim().max(4000).optional(),
    recommendedAction: z.string().trim().max(2000).optional(),
  })
  .refine((v) => Object.values(v).some((x) => x !== undefined), "Tidak ada yang diperbarui");

export const textSchema = z.object({ text: z.string().trim().min(1, "Teks wajib diisi").max(5000) });

export const sentimentSchema = z
  .object({
    text: z.string().trim().min(1).max(5000).optional(),
    texts: z.array(z.string().trim().min(1).max(5000)).min(1).max(100).optional(),
  })
  .refine((v) => Boolean(v.text) !== Boolean(v.texts), "Isi salah satu: text atau texts");

export const snaSchema = z.object({
  nodeTypes: z.array(z.enum(["account", "post", "hashtag", "topic"])).optional(),
  platform: platformSchema.optional(),
  minDegree: z.number().int().min(0).max(1000).optional(),
});

/** Flattens a zod error into one readable line. */
export function formatZodError(error: z.ZodError): string {
  return error.issues.map((i) => (i.path.length ? `${i.path.join(".")}: ${i.message}` : i.message)).join("; ");
}
