import type { Metadata } from "next";
import Link from "next/link";
import { DataTable, Pagination } from "@/components/tables/DataTable";
import { PlatformBadge, StatusBadge, Badge } from "@/components/ui/badges";
import { FilterPanel } from "@/components/ui/FilterPanel";
import { Flash, LinkButton, PageHeader } from "@/components/ui/layout";
import { userName } from "@/lib/auth/directory";
import { verifySession } from "@/lib/auth/dal";
import { can } from "@/lib/auth/permissions";
import { listCases } from "@/lib/services/cases";
import { CASE_STATUSES, POLICY_CATEGORIES, PRIORITIES } from "@/lib/validation/schemas";
import { formatDate, truncate } from "@/lib/utils/format";
import { CASE_STATUS_LABEL, POLICY_CATEGORY_LABEL, PRIORITY_LABEL } from "@/lib/i18n/labels";
import { enumParam, pageParam, paginate, param } from "@/lib/utils/params";
import { PLATFORMS, PLATFORM_LABEL } from "@/lib/utils/platforms";

export const metadata: Metadata = { title: "Kasus" };

export default async function CasesPage({ searchParams }: PageProps<"/cases">) {
  const user = await verifySession();
  const sp = await searchParams;
  const q = param(sp, "q").slice(0, 200);
  const status = enumParam(sp, "status", CASE_STATUSES);
  const priority = enumParam(sp, "priority", PRIORITIES);
  const platform = enumParam(sp, "platform", PLATFORMS);
  const category = enumParam(sp, "category", POLICY_CATEGORIES);

  const all = (await listCases()).filter(
    (c) => (!status || c.status === status) && (!priority || c.priority === priority) && (!platform || c.platform === platform)
      && (!category || c.category === category) && (!q || `${c.id} ${c.title} ${c.description}`.toLowerCase().includes(q.toLowerCase())),
  );
  const { rows, page, pages, total } = paginate(all, pageParam(sp), 15);
  const values = Object.fromEntries(Object.entries({ q, status, priority, platform, category }).filter(([, v]) => v)) as Record<string, string>;

  return (
    <div>
      <PageHeader
        title="Kasus"
        description="Ruang kerja investigasi. Kasus bergerak Terbuka → Diselidiki → Perlu ditinjau → Terverifikasi → Sudah dilaporkan; verifikasi selalu memerlukan peninjau manusia selain analis yang menangani."
        actions={can(user.role, "case:create") ? <LinkButton href="/cases/new" variant="primary">Kasus baru</LinkButton> : undefined}
      />
      <Flash searchParams={sp} />
      <FilterPanel
        action="/cases"
        values={values}
        fields={[
          { name: "q", label: "Cari", type: "text" },
          { name: "status", label: "Status", options: CASE_STATUSES.map((s) => ({ value: s, label: CASE_STATUS_LABEL[s] })) },
          { name: "priority", label: "Prioritas", options: PRIORITIES.map((p) => ({ value: p, label: PRIORITY_LABEL[p] })) },
          { name: "platform", label: "Platform", options: PLATFORMS.map((p) => ({ value: p, label: PLATFORM_LABEL[p] })) },
          { name: "category", label: "Kategori", options: POLICY_CATEGORIES.map((c) => ({ value: c, label: POLICY_CATEGORY_LABEL[c] })) },
        ]}
      />
      <DataTable
        caption="Kasus"
        rows={rows}
        rowKey={(c) => c.id}
        empty="Tidak ada kasus yang cocok dengan filter ini."
        columns={[
          { header: "ID Kasus", cell: (c) => <Link href={`/cases/${c.id}`} className="font-medium text-sky-400 hover:underline">{c.id}</Link> },
          { header: "Judul", className: "max-w-sm whitespace-normal", cell: (c) => truncate(c.title, 90) },
          { header: "Platform", cell: (c) => <PlatformBadge platform={c.platform} /> },
          { header: "Kategori", cell: (c) => POLICY_CATEGORY_LABEL[c.category] },
          { header: "Prioritas", cell: (c) => <Badge tone={c.priority === "critical" ? "critical" : c.priority === "high" ? "danger" : c.priority === "medium" ? "warning" : "neutral"}>{PRIORITY_LABEL[c.priority].toUpperCase()}</Badge> },
          { header: "Analis", cell: (c) => userName(c.analystId) },
          { header: "Peninjau", cell: (c) => userName(c.reviewerId) },
          { header: "Status", cell: (c) => <StatusBadge status={c.status} /> },
          { header: "Dibuat", className: "whitespace-nowrap", cell: (c) => formatDate(c.createdAt) },
          { header: "Diperbarui", className: "whitespace-nowrap", cell: (c) => formatDate(c.updatedAt) },
        ]}
      />
      <Pagination page={page} pages={pages} total={total} basePath="/cases" params={values} />
    </div>
  );
}
