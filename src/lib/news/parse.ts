import { createHash } from "node:crypto";
import { XMLParser } from "fast-xml-parser";
import type { NewsItem } from "@/types";
import type { NewsFeed } from "./feeds";

const parser = new XMLParser({
  ignoreAttributes: true,
  processEntities: true,
  trimValues: true,
  isArray: (name) => name === "item",
});

const MAX_SUMMARY = 220;

/** Strips markup and collapses whitespace: feed text is untrusted. */
export function cleanText(input: unknown): string {
  if (typeof input !== "string" && typeof input !== "number") return "";
  return String(input)
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

function truncate(text: string, max: number): string {
  return text.length <= max ? text : `${text.slice(0, max - 1).trimEnd()}…`;
}

/** Only plain web links are accepted. */
export function safeLink(value: unknown): string | null {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value.trim());
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : null;
  } catch {
    return null;
  }
}

const idOf = (link: string) => createHash("sha1").update(link).digest("hex").slice(0, 12);

/** Decodes bytes using the charset declared in the XML prolog, then the HTTP header, else UTF-8. */
export function decodeFeed(bytes: ArrayBuffer, contentType = ""): string {
  const head = new TextDecoder("latin1").decode(bytes.slice(0, 200));
  const declared = /encoding=["']([\w-]+)["']/i.exec(head)?.[1] ?? /charset=([\w-]+)/i.exec(contentType)?.[1] ?? "utf-8";
  try {
    return new TextDecoder(declared).decode(bytes);
  } catch {
    return new TextDecoder("utf-8").decode(bytes);
  }
}

/** RSS 2.0 → items. Items with a missing title, unsafe link or invalid date are skipped. */
export function parseFeed(xml: string, feed: Pick<NewsFeed, "name">): NewsItem[] {
  let doc: { rss?: { channel?: { item?: Record<string, unknown>[] } } };
  try {
    doc = parser.parse(xml);
  } catch {
    return [];
  }
  const items: NewsItem[] = [];
  for (const raw of doc.rss?.channel?.item ?? []) {
    const title = truncate(cleanText(raw.title), 240);
    const link = safeLink(raw.link) ?? safeLink(raw.guid);
    const time = Date.parse(String(raw.pubDate ?? ""));
    if (!title || !link || Number.isNaN(time)) continue;
    items.push({
      id: idOf(link),
      title,
      link,
      source: feed.name,
      publishedAt: new Date(time).toISOString(),
      summary: truncate(cleanText(raw.description), MAX_SUMMARY),
    });
  }
  return items;
}
