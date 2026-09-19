import type { ParsedPostUrl } from "./parse";

/**
 * Keyless public metadata for a post, via the platform's own oEmbed endpoint.
 * Only YouTube, TikTok and X offer this without a token; Instagram and Threads
 * require a Meta app token, so for those we return null (the post is still
 * viewable through the official embed).
 *
 * SSRF safety: the request URL is REBUILT from an already-parsed platform and
 * id against a fixed host allowlist. User input is never fetched directly.
 */

export interface OembedInfo {
  title: string;
  authorName: string | null;
  authorHandle: string | null;
  thumbnailUrl: string | null;
}

export type FetchLike = typeof fetch;

const TIMEOUT_MS = 6000;
const MAX_BYTES = 200_000;

/** The single place that decides which URLs the server may fetch for metadata. */
export function oembedEndpoint(p: ParsedPostUrl): string | null {
  const target = encodeURIComponent(p.canonicalUrl);
  switch (p.platform) {
    case "youtube":
      return `https://www.youtube.com/oembed?format=json&url=${target}`;
    case "tiktok":
      return `https://www.tiktok.com/oembed?url=${target}`;
    case "x":
      return `https://publish.x.com/oembed?omit_script=1&dnt=true&url=${target}`;
    default:
      return null;
  }
}

export const supportsMetadata = (p: ParsedPostUrl) => oembedEndpoint(p) !== null;

const str = (v: unknown, max = 500): string | null => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null);

/** Turns a tweet's oEmbed HTML into plain text (text of the <p> only). */
export function tweetTextFromHtml(html: string): string | null {
  const p = /<p[^>]*>([\s\S]*?)<\/p>/i.exec(html)?.[1];
  if (!p) return null;
  const text = p
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&mdash;/g, "—")
    .trim();
  return text ? text.slice(0, 1000) : null;
}

function handleFromAuthorUrl(url: string | null): string | null {
  if (!url) return null;
  try {
    const seg = new URL(url).pathname.split("/").filter(Boolean)[0];
    return seg?.replace(/^@/, "") || null;
  } catch {
    return null;
  }
}

/** Parses an oEmbed JSON body for the given platform. Exported for tests. */
export function readOembed(p: ParsedPostUrl, json: unknown): OembedInfo | null {
  if (!json || typeof json !== "object") return null;
  const j = json as Record<string, unknown>;
  const authorName = str(j.author_name, 120);
  const authorUrl = str(j.author_url, 300);
  const html = str(j.html, 5000);
  const title = p.platform === "x" ? (html ? tweetTextFromHtml(html) : null) : str(j.title, 500);
  const handle = p.platform === "tiktok" ? str(j.author_unique_id, 60) ?? handleFromAuthorUrl(authorUrl) : handleFromAuthorUrl(authorUrl);
  if (!title && !authorName) return null;
  return {
    title: title ?? "",
    authorName,
    authorHandle: handle ?? p.handle,
    thumbnailUrl: /^https:\/\//i.test(str(j.thumbnail_url, 500) ?? "") ? str(j.thumbnail_url, 500) : null,
  };
}

/** Never throws: any network or format problem yields null. */
export async function fetchOembed(p: ParsedPostUrl, fetchImpl: FetchLike = fetch): Promise<OembedInfo | null> {
  const endpoint = oembedEndpoint(p);
  if (!endpoint) return null;
  try {
    const res = await fetchImpl(endpoint, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { Accept: "application/json", "User-Agent": "ThePower/1.0 (+decision-support; oembed)" },
      redirect: "error",
      cache: "no-store",
    });
    if (!res.ok) return null;
    const text = await res.text();
    if (text.length > MAX_BYTES) return null;
    return readOembed(p, JSON.parse(text));
  } catch {
    return null;
  }
}

export type Availability = "available" | "unavailable" | "unknown";

/**
 * Manual "is it still online?" check. oEmbed answers 4xx for deleted, private
 * or non-embeddable posts. A network error, timeout or 5xx is "unknown": we
 * never claim a post is gone unless the platform said so, and the result is a
 * hint for a human to confirm in the browser, not proof.
 */
export async function checkAvailability(p: ParsedPostUrl, fetchImpl: FetchLike = fetch): Promise<Availability> {
  const endpoint = oembedEndpoint(p);
  if (!endpoint) return "unknown";
  try {
    const res = await fetchImpl(endpoint, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { Accept: "application/json", "User-Agent": "ThePower/1.0 (+decision-support; availability)" },
      redirect: "error",
      cache: "no-store",
    });
    if (res.ok) return "available";
    // Verified against the live endpoints: a video that does not exist answers 400 on YouTube
    // and TikTok, 404 on X. The URL is built by us from a validated id, so 400 is not a client bug.
    if ([400, 401, 403, 404, 410].includes(res.status)) return "unavailable";
    return "unknown";
  } catch {
    return "unknown";
  }
}
