import type { Metadata } from "next";
import Link from "next/link";
import { DataTable, Pagination } from "@/components/tables/DataTable";
import { Badge } from "@/components/ui/badges";
import { FilterPanel } from "@/components/ui/FilterPanel";
import { Notice, PageHeader } from "@/components/ui/layout";
import { listDirectory } from "@/lib/auth/directory";
import { verifySession } from "@/lib/auth/dal";
import { AUDIT_ACTION_LABEL, AUDIT_RESULT_LABEL } from "@/lib/i18n/labels";
import { listAuditFor } from "@/lib/services/audit";
import { formatAgo, formatDateTime } from "@/lib/utils/format";
import { enumParam, pageParam, paginate, param } from "@/lib/utils/params";
import { nowMs } from "@/lib/utils/time";
import type { AuditAction } from "@/types";

export const metadata: Metadata = { title: "Riwayat Aktivitas" };

const ACTIONS = Object.keys(AUDIT_ACTION_LABEL) as AuditAction[];
const RESULTS = ["SUCCESS", "DENIED", "FAILED"] as const;

export default async function ActivityPage({ searchParams }: PageProps<"/audit">) {
  const user = await verifySession();
  const sp = await searchParams;
  const { entries, scope } = await listAuditFor(user);

  const action = enumParam(sp, "action", ACTIONS);
  const result = enumParam(sp, "result", RESULTS);
  const who = scope === "all" ? param(sp, "user").slice(0, 64) : "";
  const q = param(sp, "q").slice(0, 200).toLowerCase();
  const date = (k: string) => (/^\d{4}-\d{2}-\d{2}$/.test(param(sp, k)) ? param(sp, k) : "");
  const from = date("from");
  const to = date("to");

  const filtered = entries.filter(
    (e) =>
      (!action || e.action === action) &&
      (!result || e.result === result) &&
      (!who || e.userId === who) &&
      (!from || e.at.slice(0, 10) >= from) &&
      (!to || e.at.slice(0, 10) <= to) &&
      (!q || `${e.userName} ${e.object} ${e.caseId ?? ""} ${AUDIT_ACTION_LABEL[e.action]}`.toLowerCase().includes(q)),
  );
  const { rows, page, pages, total } = paginate(filtered, pageParam(sp), 20);
  const values = Object.fromEntries(Object.entries({ q: param(sp, "q"), action, result, user: who, from, to }).filter(([, v]) => v)) as Record<string, string>;

  const now = nowMs();
  const day = filtered.filter((e) => now - Date.parse(e.at) < 24 * 3_600_000);
  const stats = [
    ["Aktivitas (sesuai filter)", filtered.length],
    ["24 jam terakhir", day.length],
    ["Ditolak / gagal", filtered.filter((e) => e.result !== "SUCCESS").length],
    ["Pengguna", new Set(filtered.map((e) => e.userId)).size],
  ] as const;

  return (
    <div>
      <PageHeader
        title="Riwayat Aktivitas"
        description="Catatan kronologis siapa melakukan apa, pada objek apa, dan apakah berhasil: masuk/keluar, pencarian, analisis, kasus, bukti, dan laporan."
        mock={false}
      />
      <div className="mb-4 space-y-2">
        <Notice tone="info">
          {scope === "all"
            ? "Anda melihat aktivitas semua pengguna (hak peninjau/admin)."
            : "Anda melihat aktivitas Anda sendiri. Peninjau dan admin dapat melihat aktivitas semua pengguna."}
        </Notice>
        <Notice tone="warning">Penyimpanan prototipe: riwayat berada di memori dan kembali ke data awal saat server dimulai ulang. Versi produksi menyimpannya di database.</Notice>
      </div>

      <section aria-label="Ringkasan aktivitas" className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map(([label, value]) => (
          <div key={label} className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
            <p className="text-xs uppercase tracking-wider text-slate-500">{label}</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums text-slate-50">{value}</p>
          </div>
        ))}
      </section>

      <FilterPanel
        action="/audit"
        values={values}
        fields={[
          { name: "q", label: "Cari", type: "text", placeholder: "pengguna, objek, kasus" },
          { name: "action", label: "Aktivitas", options: ACTIONS.map((a) => ({ value: a, label: AUDIT_ACTION_LABEL[a] })) },
          { name: "result", label: "Hasil", options: RESULTS.map((r) => ({ value: r, label: AUDIT_RESULT_LABEL[r] })) },
          ...(scope === "all" ? [{ name: "user", label: "Pengguna", options: listDirectory().map((u) => ({ value: u.id, label: u.name })) }] : []),
          { name: "from", label: "Dari tanggal", type: "date" as const },
          { name: "to", label: "Sampai tanggal", type: "date" as const },
        ]}
      />
      <DataTable
        caption="Riwayat aktivitas"
        rows={rows}
        rowKey={(e) => e.id}
        empty="Belum ada aktivitas yang cocok dengan filter ini."
        columns={[
          { header: "Waktu", className: "whitespace-nowrap", cell: (e) => <span title={formatAgo(e.at, now)}>{formatDateTime(e.at)}</span> },
          { header: "Pengguna", cell: (e) => e.userName },
          { header: "Aktivitas", cell: (e) => <span className="font-medium">{AUDIT_ACTION_LABEL[e.action]}</span> },
          { header: "Objek", className: "max-w-sm whitespace-normal", cell: (e) => e.object },
          { header: "ID Kasus", cell: (e) => (e.caseId ? <Link href={`/cases/${e.caseId}`} className="text-sky-400 hover:underline">{e.caseId}</Link> : "—") },
          { header: "Hasil", cell: (e) => <Badge tone={e.result === "SUCCESS" ? "success" : e.result === "DENIED" ? "warning" : "critical"}>{AUDIT_RESULT_LABEL[e.result].toUpperCase()}</Badge> },
        ]}
      />
      <Pagination page={page} pages={pages} total={total} basePath="/audit" params={values} />
    </div>
  );
}
