import type { Platform, PlatformReportingInfo } from "@/types";

/**
 * Official reporting pages. Reports are ALWAYS filed by a human through the
 * platform's own mechanism; no submission API is integrated.
 * URLs were checked on 2026-09-18 (X and Reddit block automated requests, so
 * they could not be opened programmatically — confirm them in a browser).
 */
export const PLATFORM_REPORTING: Record<Platform, PlatformReportingInfo> = {
  facebook: {
    platform: "facebook",
    officialReportingUrl: "https://www.facebook.com/help/reportlinks",
    policyIndexUrl: "https://transparency.meta.com/policies/community-standards/",
    apiSubmissionAvailable: false,
    note: "Gunakan opsi Laporkan langsung pada konten bila memungkinkan.",
  },
  instagram: {
    platform: "instagram",
    officialReportingUrl: "https://help.instagram.com/165828726894770",
    policyIndexUrl: "https://transparency.meta.com/policies/community-standards/",
    apiSubmissionAvailable: false,
    note: "Gunakan opsi Laporkan di aplikasi pada konten bila memungkinkan.",
  },
  x: {
    platform: "x",
    officialReportingUrl: "https://help.x.com/en/safety-and-security/report-a-post",
    policyIndexUrl: "https://help.x.com/en/rules-and-policies/x-rules",
    apiSubmissionAvailable: false,
    note: "Halaman memblokir pengecekan otomatis; pastikan tautan terbuka di peramban Anda.",
  },
  youtube: {
    platform: "youtube",
    officialReportingUrl: "https://support.google.com/youtube/answer/2802027",
    policyIndexUrl: "https://support.google.com/youtube/answer/9288567",
    apiSubmissionAvailable: false,
    note: "Gunakan opsi Laporkan di bawah video atau komentar.",
  },
  tiktok: {
    platform: "tiktok",
    officialReportingUrl: "https://support.tiktok.com/en/safety-hc/report-a-problem",
    policyIndexUrl: "https://www.tiktok.com/community-guidelines/en",
    apiSubmissionAvailable: false,
    note: "Gunakan opsi Laporkan di aplikasi pada konten bila memungkinkan.",
  },
  threads: {
    platform: "threads",
    officialReportingUrl: "https://help.instagram.com/",
    policyIndexUrl: "https://transparency.meta.com/policies/community-standards/",
    apiSubmissionAvailable: false,
    note: "Threads dikelola Meta. Cara paling andal: ketuk ••• pada postingan lalu Laporkan. Halaman ini adalah Pusat Bantuan Meta; carilah topik Threads (tautan langsung ke topik tertentu belum dapat kami pastikan).",
  },
  reddit: {
    platform: "reddit",
    officialReportingUrl: "https://www.reddit.com/report",
    policyIndexUrl: "https://redditinc.com/policies/reddit-rules",
    apiSubmissionAvailable: false,
    note: "Halaman memblokir pengecekan otomatis; pastikan tautan terbuka di peramban Anda.",
  },
  telegram: {
    platform: "telegram",
    officialReportingUrl: "https://telegram.org/faq#q-there-s-illegal-content-on-telegram-how-do-i-take-it-down",
    policyIndexUrl: "https://telegram.org/tos",
    apiSubmissionAvailable: false,
    note: "FAQ Telegram menjelaskan cara melaporkan konten ilegal.",
  },
  news: {
    platform: "news",
    officialReportingUrl: "",
    policyIndexUrl: "",
    apiSubmissionAvailable: false,
    note: "Sumber berita/web tidak memiliki mekanisme pelaporan platform. Hubungi redaksi penerbit atau Dewan Pers.",
  },
};
