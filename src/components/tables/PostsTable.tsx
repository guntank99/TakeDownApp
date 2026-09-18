import Link from "next/link";
import { PlatformBadge, RiskBadge, SentimentBadge, StatusBadge } from "@/components/ui/badges";
import type { FilterField } from "@/components/ui/FilterPanel";
import { CATEGORY_KEYS, CATEGORY_LABELS, POST_STATUSES, RISK_LEVELS, SENTIMENTS } from "@/lib/services/queries";
import { formatDateTime, formatNumber, titleCase, truncate } from "@/lib/utils/format";
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
    { name: "q", label: "Search", type: "text", placeholder: "keyword, #hashtag, @username, URL…" },
    { name: "platform", label: "Platform", options: PLATFORMS.map((p) => ({ value: p, label: PLATFORM_LABEL[p] })) },
    { name: "from", label: "From date", type: "date" },
    { name: "to", label: "To date", type: "date" },
    { name: "sentiment", label: "Sentiment", options: SENTIMENTS.map((s) => ({ value: s, label: titleCase(s) })) },
    { name: "risk", label: "Risk", options: RISK_LEVELS.map((r) => ({ value: r, label: r.toUpperCase() })) },
    { name: "category", label: "Category (indicator)", options: CATEGORY_KEYS.map((c) => ({ value: c, label: CATEGORY_LABELS[c] })) },
    { name: "status", label: "Status", options: POST_STATUSES.map((s) => ({ value: s, label: titleCase(s) })) },
    {
      name: "sort",
      label: "Sort by",
      options: [
        { value: "recent", label: "Most recent" },
        { value: "risk", label: "Highest risk" },
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
    { header: "Post ID", cell: (r) => postLink(r.post.id) },
    { header: "Author", cell: (r) => <Link href={`/accounts/${r.post.authorId}`} className="text-slate-200 hover:underline">{r.handle}</Link> },
    { header: "Content", className: "max-w-xs whitespace-normal", cell: (r) => truncate(r.post.text, 90) },
  ];
  const columns: Column<PostRow>[] =
    variant === "monitoring"
      ? [
          ...base,
          { header: "Timestamp", className: "whitespace-nowrap", cell: (r) => formatDateTime(r.post.createdAt) },
          { header: "Likes", className: "text-right tabular-nums", cell: (r) => formatNumber(r.post.likes) },
          { header: "Comments", className: "text-right tabular-nums", cell: (r) => formatNumber(r.post.comments) },
          { header: "Shares", className: "text-right tabular-nums", cell: (r) => formatNumber(r.post.shares) },
          { header: "Views", className: "text-right tabular-nums", cell: (r) => formatNumber(r.post.views) },
          { header: "Sentiment", cell: (r) => <SentimentBadge sentiment={r.analysis.content.sentiment.sentiment} /> },
          { header: "Risk", cell: (r) => <RiskBadge score={r.analysis.risk.score} /> },
          { header: "Status", cell: (r) => <StatusBadge status={r.post.status} /> },
        ]
      : [
          ...base,
          { header: "Risk", cell: (r) => <RiskBadge score={r.analysis.risk.score} /> },
          {
            header: "Indicators",
            className: "max-w-[14rem] whitespace-normal",
            cell: (r) =>
              r.analysis.content.flagged.length
                ? r.analysis.content.flagged.map((k) => r.analysis.content.indicators[k].label.replace(" Indicator", "")).join(", ")
                : <span className="text-slate-500">none</span>,
          },
          { header: "Policy matches", className: "text-right tabular-nums", cell: (r) => r.analysis.policyMatches.length },
          { header: "Coordination", cell: (r) => (r.analysis.coordinationGroupSize >= 3 ? `${r.analysis.coordinationGroupSize} accounts` : <span className="text-slate-500">—</span>) },
          { header: "Status", cell: (r) => <StatusBadge status={r.post.status} /> },
        ];
  return (
    <DataTable
      caption={variant === "monitoring" ? "Monitored posts" : "Post review queue"}
      columns={columns}
      rows={rows}
      rowKey={(r) => r.post.id}
      empty="No posts match these filters."
    />
  );
}
