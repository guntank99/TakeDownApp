import type { Metadata } from "next";
import Link from "next/link";
import { DataTable, Pagination } from "@/components/tables/DataTable";
import { Badge, PlatformBadge, RiskBadge } from "@/components/ui/badges";
import { FilterPanel } from "@/components/ui/FilterPanel";
import { PageHeader } from "@/components/ui/layout";
import { accountAgeDays } from "@/lib/analysis/account";
import { verifySession } from "@/lib/auth/dal";
import { RISK_LABEL } from "@/lib/i18n/labels";
import { getAnalysisContext } from "@/lib/services/analysis";
import { RISK_LEVELS } from "@/lib/services/queries";
import { formatNumber } from "@/lib/utils/format";
import { enumParam, pageParam, paginate, param } from "@/lib/utils/params";
import { PLATFORMS, PLATFORM_LABEL } from "@/lib/utils/platforms";

export const metadata: Metadata = { title: "Akun" };

const ROLES = ["Akun Sangat Terhubung", "Potensi Hub Jaringan"] as const;

export default async function AccountsPage({ searchParams }: PageProps<"/accounts">) {
  await verifySession();
  const sp = await searchParams;
  const q = param(sp, "q").slice(0, 200);
  const platform = enumParam(sp, "platform", PLATFORMS);
  const risk = enumParam(sp, "risk", RISK_LEVELS);
  const authenticity = enumParam(sp, "authenticity", ["potentially_inauthentic"] as const);
  const role = enumParam(sp, "role", ROLES);

  const ctx = await getAnalysisContext();
  const all = ctx.accounts
    .filter((a) => {
      const an = ctx.accountAnalysis.get(a.id)!;
      if (platform && a.platform !== platform) return false;
      if (risk && an.risk.level !== risk) return false;
      if (authenticity && an.authenticityLabel !== "Berpotensi Tidak Autentik") return false;
      if (role && an.networkRole !== role) return false;
      return !q || `${a.id} ${a.handle} ${a.displayName}`.toLowerCase().includes(q.toLowerCase());
    })
    .sort((a, b) => ctx.accountAnalysis.get(b.id)!.risk.score - ctx.accountAnalysis.get(a.id)!.risk.score);

  const { rows, page, pages, total } = paginate(all, pageParam(sp), 15);
  const values = Object.fromEntries(Object.entries({ q, platform, risk, authenticity, role }).filter(([, v]) => v)) as Record<string, string>;

  return (
    <div>
      <PageHeader
        title="Akun"
        description="Indikator perilaku dan autentisitas. Bahasanya sengaja berhati-hati: sebuah akun dapat 'Berpotensi Tidak Autentik', bukan 'palsu'."
        mock={ctx.source.isMock}
      />
      <FilterPanel
        action="/accounts"
        values={values}
        fields={[
          { name: "q", label: "Cari", type: "text", placeholder: "nama pengguna atau nama tampilan" },
          { name: "platform", label: "Platform", options: PLATFORMS.map((p) => ({ value: p, label: PLATFORM_LABEL[p] })) },
          { name: "risk", label: "Risiko", options: RISK_LEVELS.map((r) => ({ value: r, label: RISK_LABEL[r] })) },
          { name: "authenticity", label: "Autentisitas", options: [{ value: "potentially_inauthentic", label: "Berpotensi Tidak Autentik" }] },
          { name: "role", label: "Peran jaringan", options: ROLES.map((r) => ({ value: r, label: r })) },
        ]}
      />
      <DataTable
        caption="Akun"
        rows={rows}
        rowKey={(a) => a.id}
        empty="Tidak ada akun yang cocok dengan filter ini."
        columns={[
          { header: "Akun", cell: (a) => <Link href={`/accounts/${a.id}`} className="font-medium text-sky-400 hover:underline">{a.handle}</Link> },
          { header: "Platform", cell: (a) => <PlatformBadge platform={a.platform} /> },
          { header: "Usia", className: "text-right tabular-nums", cell: (a) => `${accountAgeDays(a, ctx.now)} hr` },
          { header: "Pengikut", className: "text-right tabular-nums", cell: (a) => formatNumber(a.followers) },
          { header: "Mengikuti", className: "text-right tabular-nums", cell: (a) => formatNumber(a.following) },
          { header: "Posting/hari", className: "text-right tabular-nums", cell: (a) => a.postsPerDay },
          {
            header: "Autentisitas",
            cell: (a) => {
              const an = ctx.accountAnalysis.get(a.id)!;
              return an.authenticityLabel === "Berpotensi Tidak Autentik"
                ? <Badge tone="warning">BERPOTENSI TIDAK AUTENTIK · {an.authenticityConcern}</Badge>
                : <span className="text-xs text-slate-500">tidak ada kekhawatiran kuat · {an.authenticityConcern}</span>;
            },
          },
          { header: "Peran jaringan", cell: (a) => ctx.accountAnalysis.get(a.id)!.networkRole ?? <span className="text-slate-600">—</span> },
          { header: "Risiko", cell: (a) => <RiskBadge score={ctx.accountAnalysis.get(a.id)!.risk.score} /> },
        ]}
      />
      <Pagination page={page} pages={pages} total={total} basePath="/accounts" params={values} />
    </div>
  );
}
