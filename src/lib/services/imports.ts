import "server-only";

import { rateLimit } from "@/lib/api/rate-limit";
import { can } from "@/lib/auth/permissions";
import { checkAvailability, fetchOembed, type Availability, type OembedInfo } from "@/lib/embed/oembed";
import { explainUnsupported, parsePostUrl, type ParsedPostUrl } from "@/lib/embed/parse";
import { getRepository } from "@/lib/store";
import type { ImportedItem } from "@/lib/store";
import type { Account, Post, SessionUser } from "@/types";
import { logAudit } from "./audit";
import { invalidateAnalysisCache } from "./source";
import { failure, success, type Result } from "./result";
import { z } from "zod";

/**
 * Posts and videos the team collects BY LINK. The platforms' official embeds
 * make each one viewable; public metadata comes from the platform's own oEmbed
 * (YouTube, TikTok, X) and the YouTube Data API when a key is configured.
 * Nothing is scraped, and unknown numbers stay unknown instead of being guessed.
 */

const optionalCount = z.preprocess(
  (v) => (v === "" || v === null || v === undefined ? undefined : Number(v)),
  z.number().int("Angka harus bilangan bulat").min(0, "Angka tidak boleh negatif").max(10_000_000_000).optional(),
);

export const importPostSchema = z.object({
  url: z.string().trim().min(1, "Tempel tautan postingan").max(500),
  caption: z.string().trim().max(1000).optional(),
  note: z.string().trim().max(500).optional(),
  views: optionalCount,
  likes: optionalCount,
  comments: optionalCount,
  shares: optionalCount,
  postedAt: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Tanggal harus berformat TTTT-BB-HH")
    .optional()
    .or(z.literal("").transform(() => undefined)),
});

const hashtagsOf = (text: string) => [...new Set(text.match(/#[\p{L}\p{N}_]+/gu) ?? [])].slice(0, 30);
const mentionsOf = (text: string) => [...new Set(text.match(/@[A-Za-z0-9._]{2,40}/g) ?? [])].slice(0, 30);

export const importedPostId = (p: Pick<ParsedPostUrl, "platform" | "id">) => `IMP-${p.platform.toUpperCase()}-${p.id}`;

interface YouTubeStats {
  title: string;
  channelTitle: string;
  publishedAt: string;
  views: number;
  likes: number;
  comments: number;
  thumbnailUrl: string | null;
}

/** Optional: the official YouTube Data API gives real view/like counts and the publish date. */
async function youtubeStats(videoId: string, fetchImpl: typeof fetch): Promise<YouTubeStats | null> {
  const key = process.env.YOUTUBE_API_KEY;
  if (!key) return null;
  try {
    const url = `https://www.googleapis.com/youtube/v3/videos?${new URLSearchParams({ part: "snippet,statistics", id: videoId })}`;
    const res = await fetchImpl(url, { headers: { "x-goog-api-key": key, Accept: "application/json" }, signal: AbortSignal.timeout(6000), cache: "no-store" });
    if (!res.ok) return null;
    const v = ((await res.json()) as { items?: { snippet: { title: string; channelTitle: string; publishedAt: string; thumbnails?: { medium?: { url?: string } } }; statistics?: Record<string, string> }[] }).items?.[0];
    if (!v) return null;
    const n = (x?: string) => Number.parseInt(x ?? "0", 10) || 0;
    return {
      title: v.snippet.title,
      channelTitle: v.snippet.channelTitle,
      publishedAt: v.snippet.publishedAt,
      views: n(v.statistics?.viewCount),
      likes: n(v.statistics?.likeCount),
      comments: n(v.statistics?.commentCount),
      thumbnailUrl: v.snippet.thumbnails?.medium?.url?.startsWith("https://") ? v.snippet.thumbnails.medium.url : null,
    };
  } catch {
    return null;
  }
}

export interface ImportDeps {
  fetch: typeof fetch;
  now: () => Date;
}
const defaultDeps: ImportDeps = { fetch: (...a) => fetch(...a), now: () => new Date() };

/** Adds a post by URL. Public so tests can inject fetch; the server action uses the defaults. */
export async function importPost(user: SessionUser, raw: unknown, deps: ImportDeps = defaultDeps): Promise<Result<Post>> {
  if (!can(user.role, "post:import")) {
    await logAudit({ user, action: "IMPORT_POST", object: "tautan", result: "DENIED" });
    return failure("Peran Anda tidak dapat menambahkan postingan.", 403);
  }
  const parsedInput = importPostSchema.safeParse(raw);
  if (!parsedInput.success) return failure(parsedInput.error.issues[0]?.message ?? "Input tidak valid.");
  const input = parsedInput.data;

  const parsed = parsePostUrl(input.url);
  if (!parsed) return failure(explainUnsupported(input.url));

  // Each import can trigger an outbound request, so it is limited per user.
  const limited = rateLimit(`import:${user.id}`, 30, 60 * 60_000);
  if (!limited.ok) return failure(`Terlalu banyak tautan ditambahkan. Coba lagi dalam ${Math.ceil(limited.retryAfter / 60)} menit.`, 429);

  const repo = await getRepository();
  const id = importedPostId(parsed);
  if (await repo.getImported(id)) return failure(`Postingan ini sudah ada di ruang kerja (${id}).`, 409);

  const now = deps.now().toISOString();
  const [meta, yt]: [OembedInfo | null, YouTubeStats | null] = await Promise.all([
    fetchOembed(parsed, deps.fetch),
    parsed.platform === "youtube" ? youtubeStats(parsed.id, deps.fetch) : Promise.resolve(null),
  ]);

  const handle = parsed.handle ?? meta?.authorHandle ?? null;
  const authorName = meta?.authorName ?? yt?.channelTitle ?? null;
  const accountId = handle ? `IMP-ACC-${parsed.platform.toUpperCase()}-${handle.toLowerCase()}` : `IMP-ACC-${parsed.platform.toUpperCase()}-${parsed.id}`;

  const text = input.caption || meta?.title || yt?.title || "";
  const provenance = { source: yt ? "youtube-data-api-v3" : meta ? `oembed:${parsed.platform}` : "tautan manual", collectionMethod: "manual_import" as const, collectedAt: now, isMock: false };

  const manual = [input.views, input.likes, input.comments, input.shares].some((v) => v !== undefined);
  const metricsKnown = Boolean(yt) || manual;
  const postedAt = yt?.publishedAt ?? (input.postedAt ? `${input.postedAt}T00:00:00.000Z` : null);

  const account: Account = {
    id: accountId,
    platform: parsed.platform,
    handle: handle ? `@${handle}` : "(tidak diketahui)",
    displayName: authorName ?? (handle ? `@${handle}` : "Akun tidak diketahui"),
    createdAt: now,
    followers: 0,
    following: 0,
    verified: false,
    postsPerDay: 0,
    profileCompleteness: 0,
    contentRepetition: 0,
    activitySpike: false,
    metricsKnown: false,
    provenance,
  };
  const post: Post = {
    id,
    platform: parsed.platform,
    url: parsed.canonicalUrl,
    authorId: accountId,
    text: text || "(Teks belum diketahui. Buka tayangan untuk melihat isi, atau isi kolom keterangan agar dapat dianalisis.)",
    mediaType: parsed.isVideo ? "video" : "link",
    hashtags: hashtagsOf(text),
    mentions: mentionsOf(text),
    issueId: null,
    claimId: null,
    createdAt: postedAt ?? now,
    dateKnown: postedAt !== null,
    likes: yt?.likes ?? input.likes ?? 0,
    comments: yt?.comments ?? input.comments ?? 0,
    shares: input.shares ?? 0,
    views: yt?.views ?? input.views ?? 0,
    metricsKnown,
    status: "new",
    thumbnailUrl: yt?.thumbnailUrl ?? meta?.thumbnailUrl ?? null,
    note: input.note || undefined,
    importedBy: user.id,
    provenance,
  };
  await repo.saveImported({ post, account });
  invalidateAnalysisCache();
  await logAudit({ user, action: "IMPORT_POST", object: `${id} (${provenance.source})` });
  return success(post);
}

export async function listImportedPosts(): Promise<ImportedItem[]> {
  const all = await (await getRepository()).listImported();
  return all.sort((a, b) => b.post.provenance.collectedAt.localeCompare(a.post.provenance.collectedAt));
}

/**
 * Removes a link the team added. Refused when the post is already part of a
 * case or evidence: records that back a report must not silently disappear.
 */
export async function deleteImportedPost(user: SessionUser, postId: string): Promise<Result<true>> {
  const repo = await getRepository();
  const item = await repo.getImported(postId);
  if (!item) return failure("Postingan tidak ditemukan atau bukan tautan yang ditambahkan manual.", 404);
  const isOwner = item.post.importedBy === user.id;
  if (!(can(user.role, "settings:admin") || (isOwner && can(user.role, "post:import")))) {
    await logAudit({ user, action: "DELETE_POST", object: postId, result: "DENIED" });
    return failure("Hanya admin atau orang yang menambahkannya yang dapat menghapus tautan ini.", 403);
  }
  const usedBy = (await repo.listCases()).find((c) => c.postIds.includes(postId));
  const evidence = (await repo.listEvidence()).find((e) => e.postId === postId);
  if (usedBy || evidence) {
    return failure(`Tidak dapat dihapus: postingan ini dipakai oleh ${usedBy ? `kasus ${usedBy.id}` : `bukti ${evidence!.id}`}.`, 409);
  }
  await repo.deleteImported(postId);
  invalidateAnalysisCache();
  await logAudit({ user, action: "DELETE_POST", object: postId });
  return success(true);
}

/**
 * User-triggered "is it still online?" check through the platform's own oEmbed
 * (YouTube, TikTok, X). It is a hint for a human, never proof, and it is not
 * run on a schedule.
 */
export async function checkPostAvailability(user: SessionUser, postId: string, deps: Pick<ImportDeps, "fetch"> = defaultDeps): Promise<Result<{ status: Availability; supported: boolean }>> {
  const repo = await getRepository();
  const item = await repo.getImported(postId);
  const url = item?.post.url;
  const parsed = url ? parsePostUrl(url) : null;
  if (!item || !parsed) return failure("Hanya postingan yang ditambahkan lewat tautan yang dapat diperiksa.", 404);

  const limited = rateLimit(`check:${user.id}`, 60, 60 * 60_000);
  if (!limited.ok) return failure("Terlalu banyak pemeriksaan. Coba lagi nanti.", 429);

  const status = await checkAvailability(parsed, deps.fetch);
  const supported = parsed.platform === "youtube" || parsed.platform === "tiktok" || parsed.platform === "x";
  if (supported) {
    item.post.lastCheck = { status, at: new Date().toISOString(), by: user.id };
    await repo.saveImported(item);
  }
  await logAudit({ user, action: "CHECK_AVAILABILITY", object: `${postId}: ${supported ? status : "tidak dapat dicek otomatis"}` });
  return success({ status, supported });
}
