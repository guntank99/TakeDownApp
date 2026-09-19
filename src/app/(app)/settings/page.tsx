import type { Metadata } from "next";
import Link from "next/link";
import { changePasswordAction } from "@/app/(app)/actions";
import { Badge } from "@/components/ui/badges";
import { Card, Flash, KeyValue, Notice, PageHeader } from "@/components/ui/layout";
import { verifySession } from "@/lib/auth/dal";
import { ROLE_LABELS } from "@/lib/auth/roles";
import { can } from "@/lib/auth/permissions";
import { NEWS_FEEDS } from "@/lib/news/feeds";
import { newsEnabled } from "@/lib/news/service";
import { appMode } from "@/lib/config/mode";
import { getProvider } from "@/lib/providers";
import { MIN_PASSWORD } from "@/lib/services/users";
import { storageIsVolatile } from "@/lib/store";
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
  "post:import": "menambahkan video/postingan lewat tautan",
  "users:manage": "mengelola pengguna",
} as const;

export default async function SettingsPage({ searchParams }: PageProps<"/settings">) {
  const sp = await searchParams;
  const user = await verifySession();
  const provider = getProvider();
  const admin = can(user.role, "settings:admin");
  const rules = listPolicyRules();
  const permissions = (Object.keys(PERMISSION_LABEL) as (keyof typeof PERMISSION_LABEL)[]).filter((p) => can(user.role, p));

  return (
    <div className="space-y-6">
      <PageHeader title="Pengaturan" description="Profil, keamanan, penyedia data, dan informasi sistem." mock={false} />
      <Flash searchParams={sp} />

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
          <li>Pengguna nonaktif langsung tidak bisa mengakses apa pun, termasuk sesi yang sedang berjalan.</li>
          <li>Percobaan masuk dibatasi (8 kali per 10 menit per nama pengguna).</li>
        </ul>
      </Card>

      <Card title="Ganti kata sandi">
        {appMode() === "demo" ? (
          <Notice tone="warning">Mode demo memakai akun contoh; kata sandi tidak dapat diganti.</Notice>
        ) : (
          <form action={changePasswordAction} className="grid max-w-xl gap-3 sm:grid-cols-3">
            {[
              { name: "current", label: "Kata sandi saat ini", auto: "current-password" },
              { name: "next", label: `Kata sandi baru (min. ${MIN_PASSWORD})`, auto: "new-password" },
              { name: "confirm", label: "Ulangi kata sandi baru", auto: "new-password" },
            ].map((f) => (
              <div key={f.name}>
                <label htmlFor={`pw-${f.name}`} className="mb-1 block text-xs text-slate-400">{f.label}</label>
                <input id={`pw-${f.name}`} name={f.name} type="password" required minLength={f.name === "current" ? 1 : MIN_PASSWORD} maxLength={128} autoComplete={f.auto} className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500" />
              </div>
            ))}
            <div className="sm:col-span-3"><button type="submit" className="rounded-lg bg-sky-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-sky-400">Ganti kata sandi</button></div>
          </form>
        )}
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
          { label: "Jenis data", value: provider.isMock ? "Simulasi (bukan konten sebenarnya)" : provider.id === "manual" ? "Tautan yang ditambahkan tim (tautan publik, metadata dari oEmbed resmi)" : "API resmi" },
          { label: "Platform yang dicakup", value: Object.values(PLATFORM_LABEL).join(", ") },
          { label: "Mode aplikasi", value: appMode() === "live" ? "LIVE: data nyata, tanpa data simulasi" : "DEMO: data simulasi untuk peragaan" },
          { label: "Penyimpanan ruang kerja", value: appMode() === "demo" ? "Memori (demo; kembali ke awal saat restart)" : storageIsVolatile() ? "Memori TANPA database (data hilang saat restart)" : "PostgreSQL (permanen)" },
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
