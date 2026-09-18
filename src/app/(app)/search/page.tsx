import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState } from "@/components/ui/EmptyState";
import { Card, PageHeader } from "@/components/ui/layout";
import { PlatformBadge, RiskBadge, StatusBadge } from "@/components/ui/badges";
import { verifySession } from "@/lib/auth/dal";
import { getAnalysisContext } from "@/lib/services/analysis";
import { listCases } from "@/lib/services/cases";
import { listReports } from "@/lib/services/reports";
import { truncate } from "@/lib/utils/format";
import { param } from "@/lib/utils/params";

export const metadata: Metadata = { title: "Search" };

const URL_RE = /https?:\/\/\S+|mock:\/\/\S+/g;

export default async function SearchPage({ searchParams }: PageProps<"/search">) {
  await verifySession();
  const sp = await searchParams;
  const q = param(sp, "q").slice(0, 200);
  const needle = q.toLowerCase();
  const ctx = await getAnalysisContext();

  if (!q) {
    return (
      <div>
        <PageHeader title="Search" description="Search posts, accounts, issues, cases, reports, hashtags and URLs." mock={false} />
        <EmptyState message="Type a keyword, #hashtag, @username or URL in the search bar above." />
      </div>
    );
  }

  const has = (...parts: (string | null | undefined)[]) => parts.some((p) => p?.toLowerCase().includes(needle));
  const posts = ctx.posts.filter((p) => has(p.id, p.text, p.url, ...p.hashtags, ctx.accountById.get(p.authorId)?.handle));
  const accounts = ctx.accounts.filter((a) => has(a.id, a.handle, a.displayName));
  const issues = ctx.issues.filter((i) => has(i.id, i.title, i.hashtag));
  const cases = listCases().filter((c) => has(c.id, c.title, c.description));
  const reports = (await listReports()).filter((r) => has(r.id, r.title, r.caseId));
  const hashtags = [...new Set(ctx.posts.flatMap((p) => p.hashtags))].filter((h) => has(h));
  const urls = [...new Set(ctx.posts.flatMap((p) => [p.url, ...(p.text.match(URL_RE) ?? [])]))].filter((u) => has(u));
  const total = posts.length + accounts.length + issues.length + cases.length + reports.length + hashtags.length + urls.length;

  const list = "space-y-2 text-sm";
  const row = "flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-800 px-3 py-2";

  return (
    <div className="space-y-6">
      <PageHeader title={`Search: “${q}”`} description={`${total} result${total === 1 ? "" : "s"} across posts, accounts, issues, cases, reports, hashtags and URLs.`} mock={ctx.source.isMock} />
      {total === 0 ? <EmptyState message="No results. Try a different keyword." /> : null}

      {posts.length ? (
        <Card title={`Posts (${posts.length})`} action={<Link href={`/monitoring?q=${encodeURIComponent(q)}`} className="text-xs text-sky-400 hover:underline">Open in Monitoring</Link>}>
          <ul className={list}>
            {posts.slice(0, 8).map((p) => (
              <li key={p.id} className={row}>
                <span className="min-w-0"><Link href={`/posts/${p.id}`} className="font-medium text-sky-400 hover:underline">{p.id}</Link> <span className="text-slate-300">{truncate(p.text, 90)}</span></span>
                <span className="flex items-center gap-2"><PlatformBadge platform={p.platform} /><RiskBadge score={ctx.postAnalysis.get(p.id)!.risk.score} /></span>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
      {accounts.length ? (
        <Card title={`Accounts (${accounts.length})`}>
          <ul className={list}>
            {accounts.slice(0, 8).map((a) => (
              <li key={a.id} className={row}>
                <Link href={`/accounts/${a.id}`} className="font-medium text-sky-400 hover:underline">{a.handle}</Link>
                <span className="flex items-center gap-2"><PlatformBadge platform={a.platform} /><RiskBadge score={ctx.accountAnalysis.get(a.id)!.risk.score} /></span>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
      {issues.length ? (
        <Card title={`Issues (${issues.length})`}>
          <ul className={list}>{issues.map((i) => <li key={i.id} className={row}><Link href={`/monitoring?issue=${i.id}`} className="text-sky-400 hover:underline">{i.title}</Link><span className="text-slate-500">{i.hashtag}</span></li>)}</ul>
        </Card>
      ) : null}
      {cases.length ? (
        <Card title={`Cases (${cases.length})`}>
          <ul className={list}>{cases.map((c) => <li key={c.id} className={row}><Link href={`/cases/${c.id}`} className="text-sky-400 hover:underline">{c.id} — {truncate(c.title, 70)}</Link><StatusBadge status={c.status} /></li>)}</ul>
        </Card>
      ) : null}
      {reports.length ? (
        <Card title={`Reports (${reports.length})`}>
          <ul className={list}>{reports.map((r) => <li key={r.id} className={row}><Link href={`/reports/${r.id}`} className="text-sky-400 hover:underline">{r.id} — {truncate(r.title, 70)}</Link><StatusBadge status={r.status} /></li>)}</ul>
        </Card>
      ) : null}
      {hashtags.length ? (
        <Card title={`Hashtags (${hashtags.length})`}>
          <ul className="flex flex-wrap gap-2">{hashtags.map((h) => <li key={h}><Link href={`/monitoring?q=${encodeURIComponent(h)}`} className="rounded-md border border-slate-700 px-2 py-1 text-sm text-sky-300 hover:bg-slate-800">{h}</Link></li>)}</ul>
        </Card>
      ) : null}
      {urls.length ? (
        <Card title={`URLs (${urls.length})`}>
          <ul className={list}>{urls.slice(0, 10).map((u) => <li key={u} className="break-all text-slate-300">{u}</li>)}</ul>
        </Card>
      ) : null}
    </div>
  );
}
