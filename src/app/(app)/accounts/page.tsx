import type { Metadata } from "next";
import Link from "next/link";
import { DataTable, Pagination } from "@/components/tables/DataTable";
import { Badge, PlatformBadge, RiskBadge } from "@/components/ui/badges";
import { FilterPanel } from "@/components/ui/FilterPanel";
import { PageHeader } from "@/components/ui/layout";
import { accountAgeDays } from "@/lib/analysis/account";
import { verifySession } from "@/lib/auth/dal";
import { getAnalysisContext } from "@/lib/services/analysis";
import { RISK_LEVELS } from "@/lib/services/queries";
import { formatNumber } from "@/lib/utils/format";
import { enumParam, pageParam, paginate, param } from "@/lib/utils/params";
import { PLATFORMS, PLATFORM_LABEL } from "@/lib/utils/platforms";

export const metadata: Metadata = { title: "Accounts" };

export default async function AccountsPage({ searchParams }: PageProps<"/accounts">) {
  await verifySession();
  const sp = await searchParams;
  const q = param(sp, "q").slice(0, 200);
  const platform = enumParam(sp, "platform", PLATFORMS);
  const risk = enumParam(sp, "risk", RISK_LEVELS);
  const authenticity = enumParam(sp, "authenticity", ["potentially_inauthentic"] as const);
  const role = enumParam(sp, "role", ["Highly Connected Account", "Potential Network Hub"] as const);

  const ctx = await getAnalysisContext();
  const all = ctx.accounts
    .filter((a) => {
      const an = ctx.accountAnalysis.get(a.id)!;
      if (platform && a.platform !== platform) return false;
      if (risk && an.risk.level !== risk) return false;
      if (authenticity && an.authenticityLabel !== "Potentially Inauthentic") return false;
      if (role && an.networkRole !== role) return false;
      return !q || `${a.id} ${a.handle} ${a.displayName}`.toLowerCase().includes(q.toLowerCase());
    })
    .sort((a, b) => ctx.accountAnalysis.get(b.id)!.risk.score - ctx.accountAnalysis.get(a.id)!.risk.score);

  const { rows, page, pages, total } = paginate(all, pageParam(sp), 15);
  const values = Object.fromEntries(Object.entries({ q, platform, risk, authenticity, role }).filter(([, v]) => v)) as Record<string, string>;

  return (
    <div>
      <PageHeader
        title="Accounts"
        description="Behaviour and authenticity indicators. Wording is deliberately hedged: an account can be 'Potentially Inauthentic', never 'fake'."
        mock={ctx.source.isMock}
      />
      <FilterPanel
        action="/accounts"
        values={values}
        fields={[
          { name: "q", label: "Search", type: "text", placeholder: "handle or name" },
          { name: "platform", label: "Platform", options: PLATFORMS.map((p) => ({ value: p, label: PLATFORM_LABEL[p] })) },
          { name: "risk", label: "Risk", options: RISK_LEVELS.map((r) => ({ value: r, label: r.toUpperCase() })) },
          { name: "authenticity", label: "Authenticity", options: [{ value: "potentially_inauthentic", label: "Potentially Inauthentic" }] },
          { name: "role", label: "Network role", options: [{ value: "Highly Connected Account", label: "Highly Connected Account" }, { value: "Potential Network Hub", label: "Potential Network Hub" }] },
        ]}
      />
      <DataTable
        caption="Accounts"
        rows={rows}
        rowKey={(a) => a.id}
        empty="No accounts match these filters."
        columns={[
          { header: "Account", cell: (a) => <Link href={`/accounts/${a.id}`} className="font-medium text-sky-400 hover:underline">{a.handle}</Link> },
          { header: "Platform", cell: (a) => <PlatformBadge platform={a.platform} /> },
          { header: "Age", className: "text-right tabular-nums", cell: (a) => `${accountAgeDays(a, ctx.now)} d` },
          { header: "Followers", className: "text-right tabular-nums", cell: (a) => formatNumber(a.followers) },
          { header: "Following", className: "text-right tabular-nums", cell: (a) => formatNumber(a.following) },
          { header: "Posts/day", className: "text-right tabular-nums", cell: (a) => a.postsPerDay },
          {
            header: "Authenticity",
            cell: (a) => {
              const an = ctx.accountAnalysis.get(a.id)!;
              return an.authenticityLabel === "Potentially Inauthentic"
                ? <Badge tone="warning">POTENTIALLY INAUTHENTIC · {an.authenticityConcern}</Badge>
                : <span className="text-xs text-slate-500">no strong concerns · {an.authenticityConcern}</span>;
            },
          },
          { header: "Network role", cell: (a) => ctx.accountAnalysis.get(a.id)!.networkRole ?? <span className="text-slate-600">—</span> },
          { header: "Risk", cell: (a) => <RiskBadge score={ctx.accountAnalysis.get(a.id)!.risk.score} /> },
        ]}
      />
      <Pagination page={page} pages={pages} total={total} basePath="/accounts" params={values} />
    </div>
  );
}
