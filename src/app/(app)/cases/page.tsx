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
import { formatDate, titleCase, truncate } from "@/lib/utils/format";
import { enumParam, pageParam, paginate, param } from "@/lib/utils/params";
import { PLATFORMS, PLATFORM_LABEL } from "@/lib/utils/platforms";

export const metadata: Metadata = { title: "Cases" };

export default async function CasesPage({ searchParams }: PageProps<"/cases">) {
  const user = await verifySession();
  const sp = await searchParams;
  const q = param(sp, "q").slice(0, 200);
  const status = enumParam(sp, "status", CASE_STATUSES);
  const priority = enumParam(sp, "priority", PRIORITIES);
  const platform = enumParam(sp, "platform", PLATFORMS);
  const category = enumParam(sp, "category", POLICY_CATEGORIES);

  const all = listCases().filter(
    (c) => (!status || c.status === status) && (!priority || c.priority === priority) && (!platform || c.platform === platform)
      && (!category || c.category === category) && (!q || `${c.id} ${c.title} ${c.description}`.toLowerCase().includes(q.toLowerCase())),
  );
  const { rows, page, pages, total } = paginate(all, pageParam(sp), 15);
  const values = Object.fromEntries(Object.entries({ q, status, priority, platform, category }).filter(([, v]) => v)) as Record<string, string>;

  return (
    <div>
      <PageHeader
        title="Cases"
        description="Investigation workspace. Cases move OPEN → INVESTIGATING → NEEDS REVIEW → VERIFIED → REPORTED; verification always needs a human reviewer other than the analyst."
        actions={can(user.role, "case:create") ? <LinkButton href="/cases/new" variant="primary">New case</LinkButton> : undefined}
      />
      <Flash searchParams={sp} />
      <FilterPanel
        action="/cases"
        values={values}
        fields={[
          { name: "q", label: "Search", type: "text" },
          { name: "status", label: "Status", options: CASE_STATUSES.map((s) => ({ value: s, label: s.replace("_", " ") })) },
          { name: "priority", label: "Priority", options: PRIORITIES.map((p) => ({ value: p, label: titleCase(p) })) },
          { name: "platform", label: "Platform", options: PLATFORMS.map((p) => ({ value: p, label: PLATFORM_LABEL[p] })) },
          { name: "category", label: "Category", options: POLICY_CATEGORIES.map((c) => ({ value: c, label: c })) },
        ]}
      />
      <DataTable
        caption="Cases"
        rows={rows}
        rowKey={(c) => c.id}
        empty="No cases match these filters."
        columns={[
          { header: "Case ID", cell: (c) => <Link href={`/cases/${c.id}`} className="font-medium text-sky-400 hover:underline">{c.id}</Link> },
          { header: "Title", className: "max-w-sm whitespace-normal", cell: (c) => truncate(c.title, 90) },
          { header: "Platform", cell: (c) => <PlatformBadge platform={c.platform} /> },
          { header: "Category", cell: (c) => c.category },
          { header: "Priority", cell: (c) => <Badge tone={c.priority === "critical" ? "critical" : c.priority === "high" ? "danger" : c.priority === "medium" ? "warning" : "neutral"}>{c.priority.toUpperCase()}</Badge> },
          { header: "Analyst", cell: (c) => userName(c.analystId) },
          { header: "Reviewer", cell: (c) => userName(c.reviewerId) },
          { header: "Status", cell: (c) => <StatusBadge status={c.status} /> },
          { header: "Created", className: "whitespace-nowrap", cell: (c) => formatDate(c.createdAt) },
          { header: "Updated", className: "whitespace-nowrap", cell: (c) => formatDate(c.updatedAt) },
        ]}
      />
      <Pagination page={page} pages={pages} total={total} basePath="/cases" params={values} />
    </div>
  );
}
