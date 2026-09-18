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
    note: "Use the in-product Report option on the content where possible.",
  },
  instagram: {
    platform: "instagram",
    officialReportingUrl: "https://help.instagram.com/165828726894770",
    policyIndexUrl: "https://transparency.meta.com/policies/community-standards/",
    apiSubmissionAvailable: false,
    note: "Use the in-app Report option on the content where possible.",
  },
  x: {
    platform: "x",
    officialReportingUrl: "https://help.x.com/en/safety-and-security/report-a-post",
    policyIndexUrl: "https://help.x.com/en/rules-and-policies/x-rules",
    apiSubmissionAvailable: false,
    note: "Page blocks automated checks; confirm it opens in your browser.",
  },
  youtube: {
    platform: "youtube",
    officialReportingUrl: "https://support.google.com/youtube/answer/2802027",
    policyIndexUrl: "https://support.google.com/youtube/answer/9288567",
    apiSubmissionAvailable: false,
    note: "Use the Report option under the video or comment.",
  },
  tiktok: {
    platform: "tiktok",
    officialReportingUrl: "https://support.tiktok.com/en/safety-hc/report-a-problem",
    policyIndexUrl: "https://www.tiktok.com/community-guidelines/en",
    apiSubmissionAvailable: false,
    note: "Use the in-app Report option on the content where possible.",
  },
  reddit: {
    platform: "reddit",
    officialReportingUrl: "https://www.reddit.com/report",
    policyIndexUrl: "https://redditinc.com/policies/reddit-rules",
    apiSubmissionAvailable: false,
    note: "Page blocks automated checks; confirm it opens in your browser.",
  },
  telegram: {
    platform: "telegram",
    officialReportingUrl: "https://telegram.org/faq#q-there-s-illegal-content-on-telegram-how-do-i-take-it-down",
    policyIndexUrl: "https://telegram.org/tos",
    apiSubmissionAvailable: false,
    note: "Telegram's FAQ explains how to report illegal content.",
  },
  news: {
    platform: "news",
    officialReportingUrl: "",
    policyIndexUrl: "",
    apiSubmissionAvailable: false,
    note: "News/web sources have no platform reporting mechanism. Contact the publisher or the relevant press-complaint body.",
  },
};
