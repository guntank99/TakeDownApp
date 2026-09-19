import type { Metadata } from "next";
import Link from "next/link";
import { Badge, PlatformBadge, StatusBadge } from "@/components/ui/badges";
import { DataTable } from "@/components/tables/DataTable";
import { startTakedownAction } from "@/app/(app)/actions";
import { Card, Flash, Notice, PageHeader } from "@/components/ui/layout";
import { verifySession } from "@/lib/auth/dal";
import { userName } from "@/lib/auth/directory";
import { TAKEDOWN_OUTCOME_LABEL } from "@/lib/i18n/labels";
import { listCases } from "@/lib/services/cases";
import { listEvidence } from "@/lib/services/evidence";
import { listReports } from "@/lib/services/reports";
import { summarizeTakedown } from "@/lib/takedown/summary";
import { can } from "@/lib/auth/permissions";
import { POLICY_CATEGORY_LABEL } from "@/lib/i18n/labels";
import { TAKEDOWN_STEPS, takedownProgress } from "@/lib/takedown/steps";
import { PLATFORM_REPORTING } from "@/lib/toc/reporting";
import { PLATFORMS, PLATFORM_LABEL } from "@/lib/utils/platforms";
import { formatDateTime } from "@/lib/utils/format";

export const metadata: Metadata = { title: "Take Down" };

const WHO = ["Analis", "Peninjau (bukan analis kasus)", "Analis menyusun, peninjau menyetujui", "Peninjau atau admin, manual di situs platform", "Peninjau atau admin"];
const WHAT = [
  "Simpan snapshot postingan beserta hash SHA-256 agar isinya dapat dibuktikan tidak berubah.",
  "Periksa bukti dan analisis, lalu verifikasi kasus. Aplikasi tidak pernah memverifikasi sendiri.",
  "Susun laporan, tulis catatan peninjau, dan setujui. Penyusun tidak boleh menyetujui laporannya sendiri.",
  "Buka halaman pelaporan resmi platform, ajukan laporan itu sendiri, lalu catat pengajuannya di sini.",
  "Setelah platform menjawab (atau setelah Anda memeriksa kontennya), catat: dihapus, dibatasi, ditolak, atau tidak ada tindakan.",
];

export default async function TakedownPage({ searchParams }: PageProps<"/takedown">) {
  const user = await verifySession();
  const sp = await searchParams;
  const [cases, reports, evidence] = await Promise.all([listCases(), listReports(), listEvidence()]);

  const rows = cases
    .filter((c) => c.status !== "CLOSED")
    .map((c) => {
      const own = reports.filter((r) => r.caseId === c.id);
      const progress = takedownProgress(c, evidence.filter((e) => e.caseId === c.id).length, own);
      const filed = own.find((r) => r.id === progress.reportId && r.submission);
      return { c, progress, outcome: filed?.submission?.outcome ?? null };
    });
  const summary = summarizeTakedown(cases, reports);
  const perStage = TAKEDOWN_STEPS.map((s) => ({ ...s, count: rows.filter((r) => r.progress.stage === s.key).length }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Pusat Take Down"
        description="Pusat permintaan penghapusan konten. Aplikasi ini membantu Anda menyiapkan dasar yang kuat dan mencatat prosesnya; permintaan diajukan oleh manusia lewat kanal resmi, dan platform yang memutuskan."
      />

      <Flash searchParams={sp} />

      {can(user.role, "post:import") ? (
        <Card title="Mulai dari URL" description="Tempel tautan konten yang ingin dilaporkan. Aplikasi memeriksa platformnya, menyimpannya, lalu membuka formulir kasus. Tidak ada yang dikirim ke platform.">
          <form action={startTakedownAction} className="flex flex-wrap gap-2">
            <div className="min-w-0 flex-1 basis-80">
              <label htmlFor="takedown-url" className="sr-only">URL konten</label>
              <input id="takedown-url" name="url" type="url" required maxLength={500} placeholder="https://… (YouTube, Instagram, Facebook, X, TikTok, Threads)" className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500" />
            </div>
            <button type="submit" className="rounded-lg bg-sky-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-sky-400">Analisis &amp; mulai kasus</button>
          </form>
        </Card>
      ) : null}

      <section aria-label="Ringkasan" className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-7">
        {([
          ["Total kasus", summary.total],
          ["Terbuka", summary.open],
          ["Diajukan", summary.submitted],
          ["Menunggu keputusan", summary.underReview],
          ["Ada tindakan", summary.actionTaken],
          ["Ditolak", summary.rejected],
          ["Ditutup", summary.closed],
        ] as const).map(([label, value]) => (
          <div key={label} className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
            <p className="text-xs uppercase tracking-wider text-slate-500">{label}</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums text-slate-50">{value}</p>
          </div>
        ))}
      </section>

      <Notice tone="warning">
        Aplikasi ini <strong>tidak</strong> menghapus konten orang lain, memblokir akun, atau melapor massal secara otomatis. Fitur seperti itu melanggar ketentuan platform dan dapat merugikan orang yang tidak bersalah.
        Kritik yang sah, satire, dan karya jurnalistik bukan sasaran take down.
      </Notice>

      <Card title="Tahapan take down" description="Lima langkah, masing-masing dikerjakan dan dicatat oleh orang">
        <ol className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          {TAKEDOWN_STEPS.map((s, i) => (
            <li key={s.key} className="rounded-lg border border-slate-800 p-3">
              <p className="flex items-center gap-2 text-sm font-semibold text-slate-100">
                <span className="flex size-6 items-center justify-center rounded-full bg-sky-500 text-xs text-slate-950">{i + 1}</span>
                {s.label}
              </p>
              <p className="mt-2 text-xs text-slate-300">{WHAT[i]}</p>
              <p className="mt-2 text-xs text-slate-500">Oleh: {WHO[i]}</p>
              <p className="mt-2 text-xs text-sky-300">{perStage[i].count} kasus di tahap ini</p>
            </li>
          ))}
        </ol>
      </Card>

      <Card title="Kasus dalam proses" description="Kasus yang belum ditutup dan langkah berikutnya untuk masing-masing">
        <DataTable
          caption="Kasus dan tahap take down"
          rows={rows}
          rowKey={(r) => r.c.id}
          empty="Belum ada kasus. Mulai dari sebuah postingan atau video lalu pilih Mulai kasus take down."
          columns={[
            { header: "Kasus", cell: (r) => <Link href={`/cases/${r.c.id}`} className="font-medium text-sky-400 hover:underline">{r.c.id}</Link> },
            { header: "Judul", className: "max-w-xs whitespace-normal", cell: (r) => r.c.title },
            { header: "Platform", cell: (r) => <PlatformBadge platform={r.c.platform} /> },
            { header: "Status", cell: (r) => <StatusBadge status={r.c.status} /> },
            { header: "Tahap", cell: (r) => (r.progress.stage === "done" ? <Badge tone="success">SELESAI</Badge> : <Badge tone="info">{`${r.progress.index + 1}. ${TAKEDOWN_STEPS[r.progress.index].label}`.toUpperCase()}</Badge>) },
            { header: "Langkah berikutnya", className: "max-w-sm whitespace-normal", cell: (r) => r.progress.action },
            { header: "Hasil platform", cell: (r) => (r.outcome ? TAKEDOWN_OUTCOME_LABEL[r.outcome] : "—") },
            { header: "Analis", cell: (r) => userName(r.c.analystId) },
            { header: "Diperbarui", className: "whitespace-nowrap", cell: (r) => formatDateTime(r.c.updatedAt) },
          ]}
        />
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Per platform">
          <DataTable
            caption="Kasus per platform"
            rows={summary.byPlatform}
            rowKey={(p) => p.platform}
            empty="Belum ada data."
            columns={[
              { header: "Platform", cell: (p) => PLATFORM_LABEL[p.platform] },
              { header: "Kasus", cell: (p) => p.cases },
              { header: "Diajukan", cell: (p) => p.submitted },
              { header: "Menunggu", cell: (p) => p.underReview },
              { header: "Ada tindakan", cell: (p) => p.actionTaken },
            ]}
          />
        </Card>
        <Card title="Per kategori dugaan pelanggaran">
          <DataTable
            caption="Kasus per kategori"
            rows={summary.byCategory}
            rowKey={(k) => k.category}
            empty="Belum ada data."
            columns={[
              { header: "Kategori", cell: (k) => POLICY_CATEGORY_LABEL[k.category as keyof typeof POLICY_CATEGORY_LABEL] ?? k.category },
              { header: "Kasus", cell: (k) => k.cases },
              { header: "Terbuka", cell: (k) => k.open },
              { header: "Ditutup", cell: (k) => k.closed },
            ]}
          />
        </Card>
      </div>

      <Card title="Kanal pelaporan resmi" description="Halaman resmi tempat laporan diajukan. Tautan diperiksa 2026-09-18; beberapa platform memblokir pengecekan otomatis, jadi pastikan tautan terbuka di peramban Anda.">
        <DataTable
          caption="Kanal resmi per platform"
          rows={PLATFORMS.filter((p) => p !== "news")}
          rowKey={(p) => p}
          empty="—"
          columns={[
            { header: "Platform", cell: (p) => PLATFORM_LABEL[p] },
            {
              header: "Pelaporan",
              cell: (p) => {
                const url = PLATFORM_REPORTING[p].officialReportingUrl;
                return url ? <a href={url} target="_blank" rel="noopener noreferrer" className="text-sky-400 hover:underline">Buka halaman resmi</a> : "—";
              },
            },
            { header: "Catatan", className: "max-w-xl whitespace-normal", cell: (p) => PLATFORM_REPORTING[p].note },
          ]}
        />
        <p className="mt-3 text-xs text-slate-500">
          Untuk konten yang melanggar hukum Indonesia, Komdigi menyediakan kanal aduan konten (aduankonten.id). Situs tersebut tidak dapat kami verifikasi secara otomatis; pastikan alamat resmi dari komdigi.go.id sebelum memakainya.
          Untuk berita atau karya jurnalistik, ajukan ke Dewan Pers, bukan ke platform.
        </p>
      </Card>
    </div>
  );
}
