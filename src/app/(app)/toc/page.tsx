import type { Metadata } from "next";
import { DataTable, Pagination } from "@/components/tables/DataTable";
import { Badge, PlatformBadge } from "@/components/ui/badges";
import { FilterPanel } from "@/components/ui/FilterPanel";
import { Card, Notice, PageHeader } from "@/components/ui/layout";
import { verifySession } from "@/lib/auth/dal";
import { PLATFORM_REPORTING } from "@/lib/toc/reporting";
import { listPolicyRules } from "@/lib/toc/rules";
import { POLICY_CATEGORIES } from "@/lib/validation/schemas";
import { formatDate, titleCase } from "@/lib/utils/format";
import { enumParam, pageParam, paginate, param } from "@/lib/utils/params";
import { PLATFORMS, PLATFORM_LABEL } from "@/lib/utils/platforms";

export const metadata: Metadata = { title: "ToC / ToS" };

export default async function TocPage({ searchParams }: PageProps<"/toc">) {
  await verifySession();
  const sp = await searchParams;
  const q = param(sp, "q").slice(0, 200);
  const platform = enumParam(sp, "platform", PLATFORMS);
  const category = enumParam(sp, "category", POLICY_CATEGORIES);
  const verification = enumParam(sp, "verification", ["verified_against_official_source", "needs_verification"] as const);

  const rules = listPolicyRules();
  const filtered = rules.filter(
    (r) => (!platform || r.platform === platform) && (!category || r.category === category) && (!verification || r.verification === verification)
      && (!q || `${r.rule} ${r.description}`.toLowerCase().includes(q.toLowerCase())),
  );
  const { rows, page, pages, total } = paginate(filtered, pageParam(sp), 15);
  const values = Object.fromEntries(Object.entries({ q, platform, category, verification }).filter(([, v]) => v)) as Record<string, string>;
  const verified = rules.filter((r) => r.verification === "verified_against_official_source").length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="ToC / ToS policy database"
        description="Platform rules used for policy matching. Entries come from official pages only; anything that could not be verified is marked and must be checked before it is relied on."
        mock={false}
      />
      <Notice tone="warning">
        {verified} of {rules.length} entries are verified against an official source (Meta, YouTube, Telegram). The X, TikTok and Reddit entries are placeholders because their rule text could not be retrieved automatically; read the official page before reporting. Rule descriptions are short summaries, not legal text.
      </Notice>

      <Card title="Official reporting mechanisms" description="Reports are filed by a person through these pages. No submission API is integrated.">
        <DataTable
          caption="Official reporting pages"
          rows={PLATFORMS.map((p) => PLATFORM_REPORTING[p])}
          rowKey={(r) => r.platform}
          columns={[
            { header: "Platform", cell: (r) => <PlatformBadge platform={r.platform} /> },
            { header: "Report", className: "max-w-xs whitespace-normal", cell: (r) => r.officialReportingUrl ? <a href={r.officialReportingUrl} target="_blank" rel="noopener noreferrer" className="break-all text-sky-400 hover:underline">{r.officialReportingUrl} ↗</a> : <span className="text-slate-500">none</span> },
            { header: "Policy index", className: "max-w-xs whitespace-normal", cell: (r) => r.policyIndexUrl ? <a href={r.policyIndexUrl} target="_blank" rel="noopener noreferrer" className="break-all text-sky-400 hover:underline">{r.policyIndexUrl} ↗</a> : <span className="text-slate-500">—</span> },
            { header: "Note", className: "max-w-sm whitespace-normal text-slate-400", cell: (r) => r.note },
          ]}
        />
      </Card>

      <section>
        <FilterPanel
          action="/toc"
          values={values}
          fields={[
            { name: "q", label: "Search", type: "text" },
            { name: "platform", label: "Platform", options: PLATFORMS.map((p) => ({ value: p, label: PLATFORM_LABEL[p] })) },
            { name: "category", label: "Policy category", options: POLICY_CATEGORIES.map((c) => ({ value: c, label: c })) },
            { name: "verification", label: "Verification", options: [{ value: "verified_against_official_source", label: "Verified" }, { value: "needs_verification", label: "Needs verification" }] },
          ]}
        />
        <DataTable
          caption="Policy rules"
          rows={rows}
          rowKey={(r) => r.id}
          empty="No policy rules match these filters."
          columns={[
            { header: "Platform", cell: (r) => <PlatformBadge platform={r.platform} /> },
            { header: "Category", cell: (r) => r.category },
            { header: "Rule", className: "max-w-[14rem] whitespace-normal font-medium", cell: (r) => r.rule },
            { header: "Description", className: "max-w-sm whitespace-normal text-slate-400", cell: (r) => r.description },
            { header: "Evidence to collect", className: "max-w-xs whitespace-normal text-slate-400", cell: (r) => r.evidenceRequirement },
            { header: "Severity", cell: (r) => <Badge tone={r.severity === "high" ? "danger" : r.severity === "medium" ? "warning" : "neutral"}>{titleCase(r.severity).toUpperCase()}</Badge> },
            { header: "Policy version", className: "max-w-[12rem] whitespace-normal text-slate-400", cell: (r) => r.policyVersion },
            { header: "Verification", cell: (r) => r.verification === "verified_against_official_source" ? <Badge tone="success">VERIFIED</Badge> : <Badge tone="warning">NEEDS VERIFICATION</Badge> },
            { header: "Official URL", cell: (r) => <a href={r.officialUrl} target="_blank" rel="noopener noreferrer" className="text-sky-400 hover:underline">Open ↗</a> },
            { header: "Checked", className: "whitespace-nowrap", cell: (r) => formatDate(r.lastUpdated) },
          ]}
        />
        <Pagination page={page} pages={pages} total={total} basePath="/toc" params={values} />
      </section>
      <p className="text-xs text-slate-500">The policy database is read-only in this prototype. Editing (admin only, audited as UPDATE_POLICY) arrives with the database-backed store.</p>
    </div>
  );
}
