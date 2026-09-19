import type { Metadata } from "next";
import Link from "next/link";
import { Flame } from "lucide-react";
import { EmbedPlayer } from "@/components/media/EmbedPlayer";
import { ImportForm } from "@/components/media/ImportForm";
import { Pagination } from "@/components/tables/DataTable";
import { Badge } from "@/components/ui/badges";
import { EmptyState } from "@/components/ui/EmptyState";
import { Card, Flash, Notice, PageHeader } from "@/components/ui/layout";
import { verifySession } from "@/lib/auth/dal";
import { userName } from "@/lib/auth/directory";
import { can } from "@/lib/auth/permissions";
import { embedForPost } from "@/lib/embed/for-post";
import { EMBED_PLATFORMS, EMBED_PLATFORM_LABEL, type EmbedPlatform } from "@/lib/embed/parse";
import { getAnalysisContext } from "@/lib/services/analysis";
import { formatAgo, formatCompact, formatDateTime, truncate } from "@/lib/utils/format";
import { enumParam, pageParam, paginate } from "@/lib/utils/params";
import { nowMs } from "@/lib/utils/time";
import type { Post } from "@/types";

export const metadata: Metadata = { title: "Video Viral" };

const PAGE_SIZE = 9;

export default async function VideoWallPage({ searchParams }: PageProps<"/video">) {
  const user = await verifySession();
  const sp = await searchParams;
  const platform = enumParam(sp, "platform", EMBED_PLATFORMS);
  const ctx = await getAnalysisContext();
  const now = nowMs();

  // Only posts that resolve to a real, public, embeddable post.
  const items = ctx.posts
    .map((post) => ({ post, embed: embedForPost(post) }))
    .filter((x): x is { post: Post; embed: NonNullable<ReturnType<typeof embedForPost>> } => x.embed !== null);

  const counts = Object.fromEntries(EMBED_PLATFORMS.map((p) => [p, items.filter((x) => x.post.platform === p).length])) as Record<EmbedPlatform, number>;
  const shown = items
    .filter((x) => !platform || x.post.platform === platform)
    .sort((a, b) => {
      // Real engagement first (that is what "viral" means); links with unknown numbers follow, newest first.
      const ka = a.post.metricsKnown === false ? -1 : a.post.views + a.post.likes;
      const kb = b.post.metricsKnown === false ? -1 : b.post.views + b.post.likes;
      return kb - ka || b.post.provenance.collectedAt.localeCompare(a.post.provenance.collectedAt);
    });
  const { rows, page, pages, total } = paginate(shown, pageParam(sp), PAGE_SIZE);
  const canImport = can(user.role, "post:import");
  const values = platform ? { platform } : {};
  const ytAuto = process.env.DATA_PROVIDER === "youtube" && Boolean(process.env.YOUTUBE_API_KEY);

  const tab = (key: EmbedPlatform | "", label: string, n: number) => {
    const active = platform === key;
    return (
      <Link
        key={key || "all"}
        href={key ? `/video?platform=${key}` : "/video"}
        aria-current={active ? "page" : undefined}
        className={`rounded-lg border px-3 py-1.5 text-sm transition-colors ${active ? "border-sky-500 bg-sky-500/10 text-sky-300" : "border-slate-700 text-slate-300 hover:bg-slate-800"}`}
      >
        {label} <span className="ml-1 text-xs tabular-nums text-slate-500">{n}</span>
      </Link>
    );
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Video Viral"
        description="Tonton video dan postingan dari YouTube, Instagram, X (Twitter), TikTok, Threads, dan Facebook langsung di sini, memakai pemutar resmi masing-masing platform."
      />
      <Flash searchParams={sp} />

      <Notice>
        Tidak ada API resmi gratis yang memberi daftar video trending untuk X, Instagram, TikTok, Threads, atau Facebook, dan aplikasi ini tidak melakukan scraping.
        Cara kerjanya: <strong>tempel tautan</strong> video yang sedang ramai, lalu tonton dan analisis di sini.
        {ytAuto ? " YouTube terhubung lewat API resmi, sehingga video populer di Indonesia muncul otomatis." : " Untuk video populer YouTube otomatis, atur DATA_PROVIDER=youtube dan YOUTUBE_API_KEY."}
      </Notice>

      {canImport ? (
        <Card title="Tambahkan video atau postingan" description="Hanya tautan publik satu postingan. Tautan pendek (vm.tiktok.com, t.co) tidak didukung: salin URL lengkapnya.">
          <ImportForm returnTo="/video" />
        </Card>
      ) : (
        <Notice tone="warning">Peran Anda hanya dapat menonton. Analis dan admin dapat menambahkan tautan.</Notice>
      )}

      <nav aria-label="Filter platform" className="flex flex-wrap gap-2">
        {tab("", "Semua", items.length)}
        {EMBED_PLATFORMS.map((p) => tab(p, EMBED_PLATFORM_LABEL[p], counts[p]))}
      </nav>

      {rows.length === 0 ? (
        <EmptyState
          message={
            items.length === 0
              ? "Belum ada video atau postingan. Tempel tautan di atas untuk mulai menonton dan menganalisis."
              : `Belum ada ${platform ? EMBED_PLATFORM_LABEL[platform] : "konten"} yang ditambahkan.`
          }
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {rows.map(({ post, embed }) => {
            const author = ctx.accountById.get(post.authorId);
            const risk = ctx.postAnalysis.get(post.id)?.risk.score ?? 0;
            const engagementKnown = post.metricsKnown !== false;
            return (
              <article key={post.id} className="flex min-w-0 flex-col gap-3 rounded-xl border border-slate-800 bg-slate-900/70 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone="info">{embed.platformLabel.toUpperCase()}</Badge>
                  {engagementKnown ? (
                    <span className="inline-flex items-center gap-1 text-xs text-slate-400">
                      <Flame className="size-3 text-amber-400" aria-hidden="true" />
                      {formatCompact(post.views)} tayangan · {formatCompact(post.likes)} suka
                    </span>
                  ) : (
                    <span className="text-xs text-slate-500" title="Angka interaksi tidak tersedia dari tautan. Tidak dihitung dalam peringkat.">interaksi belum diketahui</span>
                  )}
                </div>
                <EmbedPlayer
                  embedUrl={embed.embedUrl}
                  aspect={embed.aspect}
                  title={truncate(post.text, 80)}
                  platformLabel={embed.platformLabel}
                  canonicalUrl={embed.canonicalUrl}
                  thumbnailUrl={post.thumbnailUrl}
                  isVideo={embed.isVideo}
                />
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-slate-200">{truncate(post.text, 140)}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    {author?.handle ?? "penulis tidak diketahui"}
                    {post.dateKnown === false ? ` · ditambahkan ${formatAgo(post.provenance.collectedAt, now)}` : ` · ${formatDateTime(post.createdAt)}`}
                    {post.importedBy ? ` · oleh ${userName(post.importedBy)}` : ""}
                  </p>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-800 pt-3">
                  <span className="text-xs text-slate-500">{risk > 0 ? `Skor risiko ${risk}` : "Tanpa indikator"}</span>
                  <Link href={`/posts/${post.id}`} className="text-sm font-medium text-sky-400 hover:underline">Analisis &amp; tindak lanjut →</Link>
                </div>
              </article>
            );
          })}
        </div>
      )}
      <Pagination page={page} pages={pages} total={total} basePath="/video" params={values} />
    </div>
  );
}
