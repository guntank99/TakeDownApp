import type { Metadata } from "next";
import Link from "next/link";
import { Badge } from "@/components/ui/badges";
import { Card, KeyValue, Notice, PageHeader } from "@/components/ui/layout";
import { verifySession } from "@/lib/auth/dal";
import { ROLE_LABELS } from "@/lib/auth/roles";
import { can } from "@/lib/auth/permissions";
import { NEWS_FEEDS } from "@/lib/news/feeds";
import { newsEnabled } from "@/lib/news/service";
import { getProvider } from "@/lib/providers";
import { listPolicyRules } from "@/lib/toc/rules";
import { PLATFORM_LABEL } from "@/lib/utils/platforms";
import pkg from "../../../../package.json";

export const metadata: Metadata = { title: "Pengaturan" };

/** Only reports WHETHER a variable is set. Values are never read into the page. */
const configured = (...names: string[]) => names.every((n) => Boolean(process.env[n]));

const PROVIDERS = [
  { name: "Facebook", vars: ["FACEBOOK_CLIENT_ID", "FACEBOOK_CLIENT_SECRET"], active: false },
  { name: "X", vars: ["X_CLIENT_ID", "X_CLIENT_SECRET"], active: false },
  { name: "Instagram", vars: ["INSTAGRAM_CLIENT_ID", "INSTAGRAM_CLIENT_SECRET"], active: false },
  { name: "TikTok", vars: ["TIKTOK_CLIENT_KEY", "TIKTOK_CLIENT_SECRET"], active: false },
  { name: "YouTube (Data API v3)", vars: ["YOUTUBE_API_KEY"], active: true },
];

const PERMISSION_LABEL = {
  "case:create": "membuat kasus",
  "case:update": "memperbarui kasus",
  "case:verify": "memverifikasi kasus",
  "evidence:create": "mengambil bukti",
  "report:create": "membuat laporan",
  "report:review": "meninjau laporan",
  "report:submit": "mencatat pengajuan laporan",
  "audit:read": "melihat aktivitas semua pengguna",
} as const;

export default async function SettingsPage() {
  const user = await verifySession();
  const provider = getProvider();
  const admin = can(user.role, "settings:admin");
  const rules = listPolicyRules();
  const permissions = (Object.keys(PERMISSION_LABEL) as (keyof typeof PERMISSION_LABEL)[]).filter((p) => can(user.role, p));

  return (
    <div className="space-y-6">
      <PageHeader title="Pengaturan" description="Profil, keamanan, penyedia data, dan informasi sistem." mock={false} />

      <Card title="Profil">
        <KeyValue items={[
          { label: "Nama", value: user.name },
          { label: "Nama pengguna", value: user.username },
          { label: "Peran", value: ROLE_LABELS[user.role] },
          { label: "Hak akses", value: permissions.map((p) => PERMISSION_LABEL[p]).join(", ") || "hanya baca" },
        ]} />
      </Card>

      <Card title="Keamanan">
        <ul className="list-disc space-y-1 pl-5 text-sm text-slate-300">
          <li>Cookie sesi bertanda tangan: HttpOnly, SameSite=Lax, Secure di production. &ldquo;Ingat saya&rdquo; menyimpan sesi 7 hari; jika tidak, 8 jam.</li>
          <li>Peran ditegakkan di server untuk setiap halaman, aksi, dan rute API.</li>
          <li>Verifikasi dan persetujuan memerlukan peninjau selain analis yang menyusun (empat mata).</li>
          <li>Ubah kata sandi belum tersedia pada prototipe; akun berasal dari penyimpanan pengguna demo.</li>
        </ul>
      </Card>

      <Card title="Penyedia API" description="Apakah kredensial ada di environment. Nilainya tidak pernah ditampilkan.">
        {admin ? (
          <>
            <ul className="space-y-2 text-sm">
              {PROVIDERS.map((p) => (
                <li key={p.name} className="flex items-center justify-between rounded-lg border border-slate-800 px-3 py-2">
                  <span className="text-slate-200">{p.name}</span>
                  <span className="flex items-center gap-2">
                    {configured(...p.vars) ? <Badge tone="success">KREDENSIAL ADA</Badge> : <Badge>BELUM DIKONFIGURASI</Badge>}
                    {p.active ? <Badge tone="info">PENYEDIA TERSEDIA</Badge> : <Badge>INTEGRASI MENYUSUL</Badge>}
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-slate-500">Atur <code>DATA_PROVIDER=youtube</code> bersama <code>YOUTUBE_API_KEY</code> (dan <code>YOUTUBE_REGION=ID</code>) untuk memakai penyedia YouTube resmi dengan video populer di Indonesia. Platform lain diintegrasikan satu per satu, hanya lewat API resmi dengan izin yang sesuai.</p>
          </>
        ) : <Notice>Hanya administrator yang dapat melihat konfigurasi penyedia.</Notice>}
      </Card>

      <Card title="Berita viral" description="Sumber untuk halaman Viral Indonesia">
        <p className="mb-2 text-sm text-slate-300">
          Status: {newsEnabled() ? <Badge tone="success">AKTIF</Badge> : <Badge>NONAKTIF (NEWS_ENABLED=false)</Badge>}
        </p>
        <p className="text-xs text-slate-500">Feed RSS resmi penerbit: {[...new Set(NEWS_FEEDS.map((f) => f.name))].join(", ")}. Hanya judul, cuplikan, dan tautan yang dipakai.</p>
      </Card>

      <Card title="Notifikasi">
        <p className="text-sm text-slate-400">Notifikasi belum dikonfigurasi pada prototipe.</p>
      </Card>

      <Card title="Pengaturan analisis" description="Tetap pada versi ini">
        <KeyValue items={[
          { label: "Mesin", value: "lexicon-v1 (aturan kata kunci, Indonesia + Inggris)" },
          { label: "Tingkat risiko", value: "0–24 RENDAH · 25–49 SEDANG · 50–74 TINGGI · 75–100 KRITIS" },
          { label: "Komponen risiko", value: "Konten 40 · Perilaku 25 · Jaringan 20 · Koordinasi 15" },
          { label: "Koordinasi", value: "≥3 akun, kemiripan teks ≥80%, dalam 48 jam" },
          { label: "Tinjauan", value: "Semua indikator memerlukan tinjauan manusia" },
        ]} />
      </Card>

      <Card title="Aturan ToC">
        <p className="text-sm text-slate-300">
          {rules.length} aturan, {rules.filter((r) => r.verification === "verified_against_official_source").length} terverifikasi terhadap sumber resmi.{" "}
          <Link href="/toc" className="text-sky-400 hover:underline">Buka basis data kebijakan</Link>
        </p>
      </Card>

      <Card title="Sumber data">
        <KeyValue items={[
          { label: "Penyedia aktif", value: `${provider.id}: ${provider.label}` },
          { label: "Jenis data", value: provider.isMock ? "Simulasi (bukan konten sebenarnya)" : "API resmi" },
          { label: "Platform yang dicakup", value: Object.values(PLATFORM_LABEL).join(", ") },
          { label: "Penyimpanan ruang kerja", value: "Penyimpanan prototipe di memori (kembali ke awal saat restart)" },
        ]} />
      </Card>

      <Card title="Informasi sistem">
        {admin ? (
          <KeyValue items={[
            { label: "Aplikasi", value: `${pkg.name} ${pkg.version}` },
            { label: "Next.js", value: pkg.dependencies.next },
            { label: "Node.js", value: process.version },
            { label: "Lingkungan", value: process.env.NODE_ENV ?? "tidak diketahui" },
          ]} />
        ) : <Notice>Hanya administrator yang dapat melihat informasi sistem.</Notice>}
      </Card>
    </div>
  );
}
