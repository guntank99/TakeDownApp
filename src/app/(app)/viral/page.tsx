import type { Metadata } from "next";
import Link from "next/link";
import { ExternalLink, Flame, Search } from "lucide-react";
import { DataTable } from "@/components/tables/DataTable";
import { Badge, PlatformBadge, RiskBadge, SentimentBadge } from "@/components/ui/badges";
import { EmptyState } from "@/components/ui/EmptyState";
import { Card, Notice, PageHeader } from "@/components/ui/layout";
import { verifySession } from "@/lib/auth/dal";
import { searchClusters } from "@/lib/news/cluster";
import { getNews } from "@/lib/news/service";
import { getAnalysisContext } from "@/lib/services/analysis";
import { logAudit } from "@/lib/services/audit";
import { filterPosts, parsePostFilters } from "@/lib/services/queries";
import { formatAgo, formatDateTime, formatNumber, truncate } from "@/lib/utils/format";
import { param } from "@/lib/utils/params";
import { nowMs } from "@/lib/utils/time";
import { viralScores } from "@/lib/viral/score";
import type { NewsCluster } from "@/types";

export const metadata: Metadata = { title: "Viral Indonesia" };

const MAX_ITEMS_SHOWN = 5;

function ClusterCard({ cluster, now, ranked }: { cluster: NewsCluster; now: number; ranked?: number }) {
  const shown = cluster.items.slice(-MAX_ITEMS_SHOWN).reverse(); // newest first
  const hidden = cluster.items.length - shown.length;
  return (
    <article className="min-w-0 rounded-xl border border-slate-800 bg-slate-900/70 p-4">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        {ranked ? <span className="text-sm font-semibold tabular-nums text-slate-500">#{ranked}</span> : null}
        {cluster.outlets.length >= 2 ? (
          <Badge tone="danger">
            <Flame className="size-3" aria-hidden="true" /> DIBERITAKAN {cluster.outlets.length} MEDIA
          </Badge>
        ) : (
          <Badge>1 MEDIA</Badge>
        )}
        <span className="text-xs text-slate-500" title={formatDateTime(cluster.latestAt)}>{formatAgo(cluster.latestAt, now)}</span>
      </div>
      <h3 className="text-sm font-semibold leading-snug text-slate-100">{cluster.headline}</h3>
      <p className="mt-1 text-xs text-slate-500">{cluster.outlets.join(" · ")}</p>
      <ul className="mt-3 space-y-2 border-t border-slate-800 pt-3">
        {shown.map((item) => (
          <li key={item.id} className="text-sm">
            <a href={item.link} target="_blank" rel="noopener noreferrer nofollow" className="group inline-flex items-start gap-1.5 text-sky-300 hover:underline">
              <ExternalLink className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
              <span>
                <span className="font-medium">{item.source}:</span> {truncate(item.title, 130)}
              </span>
            </a>
            {item.summary && cluster.items.length === 1 ? <p className="mt-1 pl-5 text-xs text-slate-400">{item.summary}</p> : null}
          </li>
        ))}
      </ul>
      {hidden > 0 ? <p className="mt-2 text-xs text-slate-500">+{hidden} artikel lain dalam kelompok ini</p> : null}
    </article>
  );
}

export default async function ViralPage({ searchParams }: PageProps<"/viral">) {
  const user = await verifySession();
  const sp = await searchParams;
  const q = param(sp, "q").slice(0, 200);

  const [news, ctx] = await Promise.all([getNews(), getAnalysisContext()]);
  const now = nowMs();

  const matched = searchClusters(news.clusters, q);
  const trending = matched.filter((c) => c.outlets.length >= 2).slice(0, 12);
  const latest = matched
    .filter((c) => c.outlets.length < 2)
    .sort((a, b) => b.latestAt.localeCompare(a.latestAt))
    .slice(0, 18);

  // Posts: same filter as Monitoring, ranked by how fast they gather engagement.
  const scores = viralScores(ctx.posts, ctx.now);
  const viralPosts = filterPosts(ctx, parsePostFilters({ q }))
    .map((post) => ({ post, viral: scores.get(post.id)! }))
    .sort((a, b) => b.viral.score - a.viral.score)
    .slice(0, 15);

  if (q) {
    logAudit({ user, action: "SEARCH", object: `viral: "${q.slice(0, 80)}" (${matched.length} kelompok berita, ${viralPosts.length} postingan)` });
  }

  const okFeeds = news.feeds.filter((f) => f.ok);
  const failedFeeds = news.feeds.filter((f) => !f.ok);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Viral Indonesia"
        description="Berita yang sedang ramai diberitakan media Indonesia, dan postingan dengan interaksi tercepat. Gunakan pencarian untuk menelusuri topik tertentu."
        mock={false}
      />

      <form action="/viral" method="get" role="search" className="flex flex-wrap gap-2">
        <div className="relative min-w-0 flex-1 basis-72">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-500" aria-hidden="true" />
          <label htmlFor="viral-q" className="sr-only">Cari berita atau postingan viral</label>
          <input
            id="viral-q"
            name="q"
            defaultValue={q}
            maxLength={200}
            placeholder="Cari berita atau postingan viral, mis. banjir, harga beras, #tarifangkutan…"
            className="w-full rounded-lg border border-slate-700 bg-slate-950 py-2 pl-9 pr-3 text-sm text-slate-100 placeholder:text-slate-500 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
          />
        </div>
        <button type="submit" className="rounded-lg bg-sky-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-sky-400">Cari</button>
        {q ? <Link href="/viral" className="rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-300 hover:bg-slate-800">Hapus pencarian</Link> : null}
      </form>

      {/* ------------------------------------------------------------- news */}
      <section aria-labelledby="news-heading" className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 id="news-heading" className="text-base font-semibold text-slate-50">Berita ramai diberitakan</h2>
            <p className="text-xs text-slate-500">
              Sumber: RSS resmi penerbit berita Indonesia (data nyata, bukan simulasi) · diperbarui {formatAgo(news.fetchedAt, now)}
            </p>
          </div>
          <Badge tone="success">DATA NYATA</Badge>
        </div>

        {!news.enabled ? (
          <Notice tone="warning">Pengambilan berita dinonaktifkan pada deployment ini (NEWS_ENABLED=false).</Notice>
        ) : news.totalItems === 0 ? (
          <Notice tone="danger">Tidak dapat memuat berita dari penerbit saat ini. Coba lagi beberapa saat lagi.</Notice>
        ) : null}

        {news.enabled && news.totalItems > 0 ? (
          <Notice>
            Peringkat berdasarkan <strong>jumlah media yang memberitakan hal yang sama</strong>, bukan jumlah pembaca atau interaksi. Pengelompokan dilakukan otomatis
            dari kemiripan judul dan bisa keliru: cerita yang berbeda dapat tergabung, atau cerita yang sama tidak tergabung. Klik tautan untuk membaca di situs penerbit.
          </Notice>
        ) : null}

        {trending.length > 0 ? (
          <div className="grid gap-4 lg:grid-cols-2">
            {trending.map((c, i) => <ClusterCard key={c.id} cluster={c} now={now} ranked={i + 1} />)}
          </div>
        ) : news.totalItems > 0 ? (
          <EmptyState message={q ? `Tidak ada berita ramai yang cocok dengan “${q}”.` : "Belum ada cerita yang diberitakan oleh beberapa media."} />
        ) : null}

        {latest.length > 0 ? (
          <div>
            <h3 className="mb-3 mt-2 text-sm font-semibold text-slate-200">Berita terbaru{q ? ` yang cocok dengan “${q}”` : ""}</h3>
            <div className="grid gap-4 lg:grid-cols-2">
              {latest.map((c) => <ClusterCard key={c.id} cluster={c} now={now} />)}
            </div>
          </div>
        ) : null}

        {news.enabled ? (
          <details className="text-xs text-slate-500">
            <summary className="cursor-pointer select-none text-slate-400 hover:text-slate-200">
              Status sumber ({okFeeds.length} dari {news.feeds.length} feed berhasil dimuat · {formatNumber(news.totalItems)} artikel 48 jam terakhir)
            </summary>
            <ul className="mt-2 space-y-1">
              {news.feeds.map((f) => (
                <li key={f.url}>
                  <span className={f.ok ? "text-emerald-300" : "text-amber-300"}>{f.ok ? "●" : "○"}</span> {f.name}: {f.ok ? `${f.count} artikel` : `gagal (${f.error})`}
                </li>
              ))}
            </ul>
            {failedFeeds.length ? <p className="mt-2">Sumber yang gagal dilewati; hasil tetap ditampilkan dari sumber lain.</p> : null}
          </details>
        ) : null}
      </section>

      {/* ------------------------------------------------------------ posts */}
      <section aria-labelledby="posts-heading" className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 id="posts-heading" className="text-base font-semibold text-slate-50">Postingan viral</h2>
            <p className="text-xs text-slate-500">
              Sumber: {ctx.source.label} · diurutkan menurut kecepatan interaksi (suka + 2×komentar + 3×bagikan per jam sejak diposting)
            </p>
          </div>
          {ctx.source.isMock ? <Badge tone="mock">DATA MOCK</Badge> : <Badge tone="success">DATA NYATA</Badge>}
        </div>
        {ctx.source.isMock ? (
          <Notice tone="warning">
            Data postingan pada prototipe adalah <strong>simulasi</strong> dan bukan konten yang sedang viral sebenarnya. Untuk data nyata, aktifkan penyedia resmi (mis. YouTube Data API,
            wilayah Indonesia) di Pengaturan. Skor viral tidak menilai benar atau tidaknya sebuah postingan.
          </Notice>
        ) : null}
        <DataTable
          caption="Postingan viral"
          rows={viralPosts}
          rowKey={({ post }) => post.id}
          empty={q ? `Tidak ada postingan yang cocok dengan “${q}”.` : "Belum ada postingan."}
          columns={[
            { header: "#", className: "text-right tabular-nums text-slate-500", cell: ({ post }) => viralPosts.findIndex((v) => v.post.id === post.id) + 1 },
            { header: "Platform", cell: ({ post }) => <PlatformBadge platform={post.platform} /> },
            { header: "Postingan", className: "max-w-sm whitespace-normal", cell: ({ post }) => (
              <span>
                <Link href={`/posts/${post.id}`} className="font-medium text-sky-400 hover:underline">{post.id}</Link>{" "}
                <span className="text-slate-300">{truncate(post.text, 110)}</span>
              </span>
            ) },
            { header: "Penulis", cell: ({ post }) => ctx.accountById.get(post.authorId)?.handle ?? post.authorId },
            { header: "Waktu", className: "whitespace-nowrap", cell: ({ post }) => formatDateTime(post.createdAt) },
            { header: "Interaksi", className: "text-right tabular-nums", cell: ({ viral }) => formatNumber(viral.engagement) },
            { header: "Per jam", className: "text-right tabular-nums", cell: ({ viral }) => formatNumber(viral.velocity) },
            { header: "Skor viral", cell: ({ viral }) => (
              <span className="inline-flex items-center gap-2 text-xs tabular-nums" title={`Skor viral ${viral.score}/100`}>
                <span className="h-1.5 w-14 overflow-hidden rounded-full bg-slate-800" aria-hidden="true"><span className="block h-full rounded-full bg-orange-400" style={{ width: `${viral.score}%` }} /></span>
                {viral.score}
              </span>
            ) },
            { header: "Sentimen", cell: ({ post }) => <SentimentBadge sentiment={ctx.postAnalysis.get(post.id)!.content.sentiment.sentiment} /> },
            { header: "Risiko", cell: ({ post }) => <RiskBadge score={ctx.postAnalysis.get(post.id)!.risk.score} /> },
          ]}
        />
      </section>

      <Card title="Catatan penggunaan" description="Tentang data di halaman ini">
        <ul className="list-disc space-y-1 pl-5 text-sm text-slate-400">
          <li>Berita hanya menampilkan judul, cuplikan singkat, dan tautan ke penerbit asli melalui feed RSS resmi mereka. Hak cipta isi berita tetap milik penerbit.</li>
          <li>&ldquo;Ramai diberitakan&rdquo; bukan berarti benar atau salah, dan bukan berarti melanggar apa pun. Verifikasi selalu dilakukan manusia.</li>
          <li>Setiap pencarian di halaman ini tercatat di Riwayat Aktivitas.</li>
        </ul>
      </Card>
    </div>
  );
}
