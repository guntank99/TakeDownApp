import type { Platform } from "@/types";

export const PLATFORMS: readonly Platform[] = [
  "facebook",
  "x",
  "instagram",
  "tiktok",
  "youtube",
  "reddit",
  "telegram",
  "news",
];

export const PLATFORM_LABEL: Record<Platform, string> = {
  facebook: "Facebook",
  x: "X",
  instagram: "Instagram",
  tiktok: "TikTok",
  youtube: "YouTube",
  reddit: "Reddit",
  telegram: "Telegram",
  news: "Berita/Web",
};

/**
 * Categorical colours (dark-surface steps of the validated reference palette),
 * assigned per platform in fixed order so a platform keeps its colour on
 * every chart regardless of filtering.
 */
export const PLATFORM_COLOR: Record<Platform, string> = {
  facebook: "#3987e5",
  x: "#d95926",
  instagram: "#199e70",
  tiktok: "#c98500",
  youtube: "#d55181",
  reddit: "#008300",
  telegram: "#9085e9",
  news: "#e66767",
};
