import Link from "next/link";
import { PlatformBadge, RiskBadge, SentimentBadge, StatusBadge } from "@/components/ui/badges";
import type { FilterField } from "@/components/ui/FilterPanel";
import { CATEGORY_KEYS, CATEGORY_LABELS, POST_STATUSES, RISK_LEVELS, SENTIMENTS } from "@/lib/services/queries";
import { formatDateTime, formatNumber, truncate } from "@/lib/utils/format";
import { indicatorShort } from "@/lib/analysis/indicators";
import { POST_STATUS_LABEL, RISK_LABEL, SENTIMENT_LABEL } from "@/lib/i18n/labels";
import { PLATFORMS, PLATFORM_LABEL } from "@/lib/utils/platforms";
import type { Post, PostAnalysis } from "@/types";
import { DataTable, type Column } from "./DataTable";

export interface PostRow {
  post: Post;
  handle: string;
  analysis: PostAnalysis;
}

export function postFilterFields(): FilterField[] {
  return [
    { name: "q", label: "Cari", type: "text", placeholder: "kata kunci, #tagar, @nama pengguna, URL…" },
    { name: "platform", label: "Platform", options: PLATFORMS.map((p) => ({ value: p, label: PLATFORM_LABEL[p] })) },
    { name: "from", label: "Dari tanggal", type: "date" },
    { name: "to", label: "Sampai tanggal", type: "date" },
    { name: "sentiment", label: "Sentimen", options: SENTIMENTS.map((s) => ({ value: s, label: SENTIMENT_LABEL[s] })) },
    { name: "risk", label: "Risiko", options: RISK_LEVELS.map((r) => ({ value: r, label: RISK_LABEL[r] })) },
    { name: "category", label: "Kategori (indikator)", options: CATEGORY_KEYS.map((c) => ({ value: c, label: CATEGORY_LABELS[c] })) },
    { name: "status", label: "Status", options: POST_STATUSES.map((s) => ({ value: s, label: POST_STATUS_LABEL[s] })) },
    {
      name: "sort",
      label: "Urutkan",
      options: [
        { value: "recent", label: "Terbaru" },
        { value: "risk", label: "Risiko tertinggi" },
      ],
    },
  ];
}

const postLink = (id: string) => (
  <Link href={`/posts/${id}`} className="font-medium text-sky-400 hover:underline">
    {id}
  </Link>
);

export function PostsTable({ rows, variant }: { rows: PostRow[]; variant: "monitoring" | "review" }) {
  const base: Column<PostRow>[] = [
    { header: "Platform", cell: (r) => <PlatformBadge platform={r.post.platform} /> },
    { header: "ID Postingan", cell: (r) => postLink(r.post.id) },
    { header: "Penulis", cell: (r) => <Link href={`/accounts/${r.post.authorId}`} className="text-slate-200 hover:underline">{r.handle}</Link> },
    { header: "Konten", className: "max-w-xs whitespace-normal", cell: (r) => truncate(r.post.text, 90) },
  ];
  const columns: Column<PostRow>[] =
    variant === "monitoring"
      ? [
          ...base,
          { header: "Waktu", className: "whitespace-nowrap", cell: (r) => formatDateTime(r.post.createdAt) },
          { header: "Suka", className: "text-right tabular-nums", cell: (r) => formatNumber(r.post.likes) },
          { header: "Komentar", className: "text-right tabular-nums", cell: (r) => formatNumber(r.post.comments) },
          { header: "Bagikan", className: "text-right tabular-nums", cell: (r) => formatNumber(r.post.shares) },
          { header: "Tayangan", className: "text-right tabular-nums", cell: (r) => formatNumber(r.post.views) },
          { header: "Sentimen", cell: (r) => <SentimentBadge sentiment={r.analysis.content.sentiment.sentiment} /> },
          { header: "Risiko", cell: (r) => <RiskBadge score={r.analysis.risk.score} /> },
          { header: "Status", cell: (r) => <StatusBadge status={r.post.status} /> },
        ]
      : [
          ...base,
          { header: "Risiko", cell: (r) => <RiskBadge score={r.analysis.risk.score} /> },
          {
            header: "Indikator",
            className: "max-w-[14rem] whitespace-normal",
            cell: (r) =>
              r.analysis.content.flagged.length
                ? r.analysis.content.flagged.map((k) => indicatorShort(k)).join(", ")
                : <span className="text-slate-500">tidak ada</span>,
          },
          { header: "Kecocokan kebijakan", className: "text-right tabular-nums", cell: (r) => r.analysis.policyMatches.length },
          { header: "Koordinasi", cell: (r) => (r.analysis.coordinationGroupSize >= 3 ? `${r.analysis.coordinationGroupSize} akun` : <span className="text-slate-500">—</span>) },
          { header: "Status", cell: (r) => <StatusBadge status={r.post.status} /> },
        ];
  return (
    <DataTable
      caption={variant === "monitoring" ? "Postingan yang dipantau" : "Antrean tinjauan postingan"}
      columns={columns}
      rows={rows}
      rowKey={(r) => r.post.id}
      empty="Tidak ada postingan yang cocok dengan filter ini."
    />
  );
}
