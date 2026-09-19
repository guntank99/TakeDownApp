/**
 * Recognises public post/video URLs from the five supported platforms and
 * derives (a) a canonical URL and (b) the platform's OFFICIAL embed URL.
 * Pure and dependency-free, so it is safe for server and client code.
 *
 * Only URL shapes we understand are accepted; anything else (short links that
 * need a redirect to resolve, profile pages, unknown hosts) returns null with
 * a reason from explainUnsupported().
 */

export type EmbedPlatform = "youtube" | "instagram" | "x" | "tiktok" | "threads" | "facebook";
export type EmbedAspect = "16:9" | "9:16" | "tall";

export interface ParsedPostUrl {
  platform: EmbedPlatform;
  id: string;
  /** Handle taken from the URL when the platform puts it there (without "@"). */
  handle: string | null;
  canonicalUrl: string;
  embedUrl: string;
  aspect: EmbedAspect;
  isVideo: boolean;
}

export const EMBED_PLATFORMS: readonly EmbedPlatform[] = ["youtube", "instagram", "x", "tiktok", "threads", "facebook"];
export const EMBED_PLATFORM_LABEL: Record<EmbedPlatform, string> = {
  youtube: "YouTube",
  instagram: "Instagram",
  x: "X (Twitter)",
  tiktok: "TikTok",
  threads: "Threads",
  facebook: "Facebook",
};

const YT_ID = /^[A-Za-z0-9_-]{11}$/;
const IG_CODE = /^[A-Za-z0-9_-]{5,24}$/;
const HANDLE = /^[A-Za-z0-9._]{1,40}$/;

function toUrl(input: string): URL | null {
  try {
    const url = new URL(input.trim());
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    if (url.username || url.password) return null;
    return url;
  } catch {
    return null;
  }
}

const host = (url: URL) => url.hostname.toLowerCase().replace(/^(www|m|mobile)\./, "");
const segments = (url: URL) => url.pathname.split("/").filter(Boolean);

export function parsePostUrl(input: string): ParsedPostUrl | null {
  const url = toUrl(input);
  if (!url) return null;
  const h = host(url);
  const seg = segments(url);

  // ---------------------------------------------------------------- YouTube
  if (h === "youtube.com" || h === "youtube-nocookie.com" || h === "youtu.be") {
    let id: string | undefined;
    let short = false;
    if (h === "youtu.be") id = seg[0];
    else if (seg[0] === "watch") id = url.searchParams.get("v") ?? undefined;
    else if (seg[0] === "shorts") {
      id = seg[1];
      short = true;
    }
    else if (seg[0] === "embed" || seg[0] === "live" || seg[0] === "v") id = seg[1];
    if (!id || !YT_ID.test(id)) return null;
    return {
      platform: "youtube",
      id,
      handle: null,
      canonicalUrl: `https://www.youtube.com/watch?v=${id}`,
      embedUrl: `https://www.youtube-nocookie.com/embed/${id}`,
      aspect: short ? "9:16" : "16:9",
      isVideo: true,
    };
  }

  // ----------------------------------------------------------------- TikTok
  if (h === "tiktok.com") {
    const at = seg[0]?.startsWith("@") ? seg[0].slice(1) : null;
    if (at && HANDLE.test(at) && (seg[1] === "video" || seg[1] === "photo") && /^\d{8,25}$/.test(seg[2] ?? "")) {
      const id = seg[2];
      return {
        platform: "tiktok",
        id,
        handle: at,
        canonicalUrl: `https://www.tiktok.com/@${at}/${seg[1]}/${id}`,
        embedUrl: `https://www.tiktok.com/embed/v2/${id}`,
        aspect: "9:16",
        isVideo: seg[1] === "video",
      };
    }
    return null;
  }

  // -------------------------------------------------------------------- X
  if (h === "x.com" || h === "twitter.com") {
    const statusAt = seg.indexOf("status");
    const id = statusAt >= 0 ? seg[statusAt + 1] : undefined;
    if (statusAt >= 1 && id && /^\d{1,25}$/.test(id)) {
      const user = seg[0] === "i" ? null : seg[0];
      if (user && !HANDLE.test(user)) return null;
      return {
        platform: "x",
        id,
        handle: user,
        canonicalUrl: `https://x.com/${user ?? "i"}/status/${id}`,
        embedUrl: `https://platform.twitter.com/embed/Tweet.html?dnt=true&theme=dark&id=${id}`,
        aspect: "tall",
        isVideo: false,
      };
    }
    return null;
  }

  // -------------------------------------------------------------- Instagram
  if (h === "instagram.com") {
    // /p/CODE, /reel/CODE, /tv/CODE, and the /username/p/CODE variant
    const i = seg.findIndex((s) => s === "p" || s === "reel" || s === "reels" || s === "tv");
    const code = i >= 0 ? seg[i + 1] : undefined;
    if (i >= 0 && i <= 1 && code && IG_CODE.test(code)) {
      const kind = seg[i] === "p" ? "p" : seg[i] === "tv" ? "tv" : "reel";
      return {
        platform: "instagram",
        id: code,
        handle: null,
        canonicalUrl: `https://www.instagram.com/${kind}/${code}/`,
        embedUrl: `https://www.instagram.com/${kind}/${code}/embed/`,
        aspect: "tall",
        isVideo: kind !== "p",
      };
    }
    return null;
  }

  // --------------------------------------------------------------- Facebook
  if (h === "facebook.com" || h === "fb.com") {
    const FB_ID = /^[A-Za-z0-9_-]{5,100}$/;
    const FB_USER = /^[A-Za-z0-9.]{1,60}$/;
    let canonical: string | null = null;
    let id: string | undefined;
    let handle: string | null = null;
    let video = false;

    if (seg[0] === "permalink.php") {
      id = url.searchParams.get("story_fbid") ?? undefined;
      const owner = url.searchParams.get("id");
      if (id && FB_ID.test(id) && owner && /^\d{5,25}$/.test(owner)) canonical = `https://www.facebook.com/permalink.php?story_fbid=${id}&id=${owner}`;
    } else if (seg[0] === "photo" || seg[0] === "photo.php") {
      id = url.searchParams.get("fbid") ?? undefined;
      if (id && /^\d{5,25}$/.test(id)) canonical = `https://www.facebook.com/photo?fbid=${id}`;
    } else if (seg[0] === "watch" && url.searchParams.get("v")) {
      id = url.searchParams.get("v") ?? undefined;
      video = true;
      if (id && /^\d{5,25}$/.test(id)) canonical = `https://www.facebook.com/watch/?v=${id}`;
    } else if (seg[0] === "reel" && seg[1]) {
      id = seg[1];
      video = true;
      if (/^\d{5,25}$/.test(id)) canonical = `https://www.facebook.com/reel/${id}`;
    } else if (seg.length >= 3 && FB_USER.test(seg[0]) && (seg[1] === "posts" || seg[1] === "videos")) {
      handle = seg[0];
      id = seg[2];
      video = seg[1] === "videos";
      if (FB_ID.test(id)) canonical = `https://www.facebook.com/${handle}/${seg[1]}/${id}`;
    }
    if (!canonical || !id) return null;
    const href = encodeURIComponent(canonical);
    return {
      platform: "facebook",
      id,
      handle,
      canonicalUrl: canonical,
      embedUrl: video
        ? `https://www.facebook.com/plugins/video.php?href=${href}&show_text=false&width=500`
        : `https://www.facebook.com/plugins/post.php?href=${href}&show_text=true&width=500`,
      aspect: video ? "16:9" : "tall",
      isVideo: video,
    };
  }

  // ---------------------------------------------------------------- Threads
  if (h === "threads.net" || h === "threads.com") {
    const at = seg[0]?.startsWith("@") ? seg[0].slice(1) : null;
    const code = seg[2];
    if (at && HANDLE.test(at) && seg[1] === "post" && code && IG_CODE.test(code)) {
      return {
        platform: "threads",
        id: code,
        handle: at,
        canonicalUrl: `https://www.threads.com/@${at}/post/${code}`,
        embedUrl: `https://www.threads.com/@${at}/post/${code}/embed`,
        aspect: "tall",
        isVideo: false,
      };
    }
    return null;
  }

  return null;
}

/** Human-readable reason a URL was rejected (shown in the import form). */
export function explainUnsupported(input: string): string {
  const url = toUrl(input);
  if (!url) return "Tautan tidak valid. Tempel URL lengkap yang diawali https://.";
  const h = host(url);
  if (["vm.tiktok.com", "vt.tiktok.com"].includes(url.hostname.toLowerCase()) || (h === "tiktok.com" && segments(url)[0] === "t"))
    return "Tautan pendek TikTok tidak didukung. Buka videonya di browser lalu salin URL lengkap (tiktok.com/@nama/video/…).";
  if (["t.co", "bit.ly", "tinyurl.com", "lnkd.in", "fb.watch"].includes(h)) return "Tautan pendek tidak didukung. Salin URL asli postingannya.";
  if (["youtube.com", "youtu.be", "instagram.com", "x.com", "twitter.com", "tiktok.com", "threads.net", "threads.com", "facebook.com", "fb.com"].includes(h))
    return "URL ini bukan postingan/video tunggal (mungkin halaman profil, kanal, atau pencarian). Tempel URL satu postingan.";
  return "Platform tidak didukung. Yang didukung: YouTube, Instagram, Facebook, X (Twitter), TikTok, dan Threads.";
}
