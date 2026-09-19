import { EMBED_PLATFORM_LABEL, explainUnsupported, parsePostUrl, type EmbedPlatform, type ParsedPostUrl } from "@/lib/embed/parse";
import { PLATFORM_REPORTING } from "@/lib/toc/reporting";
import type { PolicyCategory, PolicyRule, ReportSubmission, TakedownOutcome } from "@/types";

/**
 * One adapter per platform. An adapter knows how to READ a link for that
 * platform and how to guide a person through the platform's OFFICIAL reporting
 * flow. No adapter can file a report by itself: none of these platforms offers
 * a public API for reporting other people's content, and this app will not fake
 * one, bypass a login or CAPTCHA, or automate the form.
 */

export type UrlErrorCode = "INVALID_URL" | "UNSUPPORTED_PLATFORM";

export type UrlCheck =
  | { ok: true; parsed: ParsedPostUrl }
  | { ok: false; code: UrlErrorCode; message: string };

/** What the person must do next. `mode` is always USER_ACTION_REQUIRED. */
export interface SubmissionGuidance {
  mode: "USER_ACTION_REQUIRED";
  officialUrl: string;
  steps: string[];
}

export type CaseStage = "not_submitted" | "under_review" | "action_taken" | "rejected" | "no_action";

export interface PlatformAdapter {
  readonly platform: EmbedPlatform;
  readonly label: string;
  validateUrl(url: string): UrlCheck;
  extractContentId(url: string): string | null;
  /** Policy categories that this platform's rules cover, from the policy library. */
  getPolicyCategories(rules: readonly PolicyRule[]): PolicyCategory[];
  /** Tips on what evidence is worth collecting on this platform. */
  evidenceHints(): string[];
  getOfficialReportUrl(): string;
  submitReport(): SubmissionGuidance;
  getCaseStatus(submission: ReportSubmission | null): CaseStage;
}

export interface AdapterConfig {
  platform: EmbedPlatform;
  evidenceHints: string[];
  /** Platform-specific way to reach the report option. */
  reportSteps: string[];
}

export function createAdapter(cfg: AdapterConfig): PlatformAdapter {
  const label = EMBED_PLATFORM_LABEL[cfg.platform];
  const info = PLATFORM_REPORTING[cfg.platform];

  const validateUrl = (url: string): UrlCheck => {
    const parsed = parsePostUrl(url);
    if (parsed && parsed.platform === cfg.platform) return { ok: true, parsed };
    if (parsed) return { ok: false, code: "UNSUPPORTED_PLATFORM", message: `Tautan ini milik ${EMBED_PLATFORM_LABEL[parsed.platform]}, bukan ${label}.` };
    const reason = explainUnsupported(url);
    return { ok: false, code: /tidak valid/i.test(reason) ? "INVALID_URL" : "UNSUPPORTED_PLATFORM", message: reason };
  };

  const outcomeStage: Record<TakedownOutcome, CaseStage> = {
    pending: "under_review",
    removed: "action_taken",
    restricted: "action_taken",
    rejected: "rejected",
    no_action: "no_action",
  };

  return {
    platform: cfg.platform,
    label,
    validateUrl,
    extractContentId(url) {
      const v = validateUrl(url);
      return v.ok ? v.parsed.id : null;
    },
    getPolicyCategories: (rules) => [...new Set(rules.filter((r) => r.platform === cfg.platform).map((r) => r.category))],
    evidenceHints: () => cfg.evidenceHints,
    getOfficialReportUrl: () => info.officialReportingUrl,
    submitReport: () => ({
      mode: "USER_ACTION_REQUIRED",
      officialUrl: info.officialReportingUrl,
      steps: [
        ...cfg.reportSteps,
        "Isi formulir pelaporan resmi dengan ringkasan dari paket laporan (salin, jangan ubah faktanya).",
        "Setelah terkirim, kembali ke sini dan catat pengajuannya. Simpan nomor tiket atau email konfirmasi dari platform.",
      ],
    }),
    getCaseStatus: (s) => (s ? outcomeStage[s.outcome ?? "pending"] : "not_submitted"),
  };
}
