# The Power

**Pantau • Analisis • Verifikasi • Dokumentasikan • Laporkan**

Ruang kerja berbasis web untuk pemantauan media sosial, SOCMINT, analisis jaringan sosial (SNA), analisis konten,
pencocokan kebijakan ToC/ToS, manajemen bukti dan kasus, serta pelaporan. Seluruh antarmuka berbahasa Indonesia.

Aplikasi ini adalah **alat bantu keputusan dan investigasi, bukan sistem sensor otomatis.** Aplikasi tidak pernah
menghapus konten, memblokir akun, melapor massal, membuat akun, melewati autentikasi atau pembatasan laju, maupun
bertindak atas akun. Setiap hasil otomatis adalah *indikator* yang disertai keyakinan, alasan, dan bukti, serta tetap
berstatus **"perlu tinjauan manusia"** sampai seseorang memutuskan. Laporan diajukan oleh manusia melalui halaman
pelaporan **resmi** platform.

```text
KUMPULKAN → ANALISIS → KORELASI → VERIFIKASI → DOKUMENTASI → TINJAUAN MANUSIA → LAPORKAN → MEKANISME RESMI PLATFORM
```

> **Data postingan bersifat mock/simulasi secara bawaan** (identitas fiktif, domain `.example`) dan UI menandainya di
> mana-mana. Halaman **Viral Indonesia** menampilkan **berita nyata** dari feed RSS resmi penerbit Indonesia.
> Penyedia YouTube Data API resmi tersedia tetapi nonaktif sampai dikonfigurasi.

## Teknologi

Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS 4 · Recharts · React Flow (`@xyflow/react`) ·
`jose` (sesi) · `bcryptjs` · `zod` · `pdf-lib` · `fast-xml-parser` · `lucide-react` · Vitest

## Menjalankan secara lokal

```bash
npm install
cp .env.example .env.local        # lalu isi AUTH_SECRET
npm run dev                       # http://localhost:3000
```

Membuat `AUTH_SECRET` (minimal 32 karakter):

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

| Skrip | Fungsi |
| --- | --- |
| `npm run dev` / `build` / `start` | pengembangan / build produksi / menjalankan hasil build |
| `npm run lint` · `npm run typecheck` | ESLint · TypeScript |
| `npm test` | uji unit + integrasi (Vitest) |
| `npm run data:generate` | membuat ulang dataset mock deterministik (`src/data/mock-*.json`) |

## Akun demo (khusus prototipe)

| Nama pengguna | Email | Peran |
| --- | --- | --- |
| `admin` | `admin@sentinel.example` | Administrator |
| `analyst` | `analyst@sentinel.example` | Analis |
| `reviewer` | `reviewer@sentinel.example` | Peninjau |

Kata sandi ketiganya: `SentinelDemo#2026`, **hanya untuk pengembangan lokal** (`npm run dev`). Kata sandi ini hanya
tersimpan sebagai hash bcrypt di `src/lib/auth/users.ts`.

**Di production akun demo dinonaktifkan** kecuali `DEMO_MODE=true` dan `DEMO_PASSWORD_HASH` (hash bcrypt dari kata
sandi *pilihan Anda*, yang lalu menggantikan kata sandi bawaan untuk semua akun demo) sama-sama diatur. Dengan begitu
kata sandi yang terdokumentasi tidak pernah berlaku pada deployment. Ganti penyimpanan pengguna dengan database
sebelum dipakai sungguhan.

## Fitur

| Area | Rute | Catatan |
| --- | --- | --- |
| Autentikasi | `/login` | cookie sesi bertanda tangan HttpOnly, ingat saya, RBAC (admin / analis / peninjau) |
| Dasbor | `/dashboard` | 7 KPI dan 7 grafik (masing-masing punya tampilan tabel data) |
| **Viral Indonesia** | `/viral` | berita nyata yang sedang ramai diberitakan + postingan viral, **dengan kolom pencarian** |
| Pemantauan | `/monitoring`, `/posts`, `/posts/[id]`, `/issues`, `/search` | pencarian kata kunci/tagar/@pengguna/URL, filter, paginasi |
| Akun | `/accounts`, `/accounts/[id]` | sinyal autentikasi ("Berpotensi Tidak Autentik", tidak pernah "palsu"), perilaku, peran jaringan |
| Analisis | `/analysis`, `/analysis/comments`, `/analysis/claims`, `/sentiment` | sentimen; indikator ujaran kebencian, pelecehan, ancaman, spam, misinformasi, pencemaran nama baik, peniruan identitas; alur klaim |
| SNA | `/sna` | graf interaktif (zoom, geser, cari, filter, pilih simpul), sentralitas, kepadatan, klaster. Istilah netral: "Akun Sangat Terhubung", "Potensi Hub Jaringan" |
| Kebijakan | `/toc` | basis data kebijakan + pencocokan; **entri belum terverifikasi ditandai** |
| Kasus | `/cases`, `/cases/new`, `/cases/[id]` | alur kerja, catatan, lini masa, verifikasi empat mata |
| Bukti | `/evidence` | snapshot ber-hash (SHA-256) dengan pemeriksaan integritas |
| Laporan | `/reports`, `/reports/[id]` | draf → tinjau → setujui → catat pengajuan; ekspor PDF / CSV / JSON |
| **Riwayat Aktivitas** | `/audit` | log kronologis: masuk/keluar, pencarian, analisis, kasus, bukti, laporan. Analis melihat aktivitasnya sendiri; peninjau/admin melihat semua |
| Pengaturan | `/settings` | profil, keamanan, penyedia (hanya ada/tidaknya kredensial), berita viral, info sistem |

### Viral Indonesia: cara kerja dan batasannya

* **Berita** diambil di server dari **feed RSS resmi** Antara, CNN Indonesia, Tempo, Republika, BBC News Indonesia, JPNN,
  dan Okezone (`src/lib/news/feeds.ts`). Hanya judul, cuplikan singkat, dan tautan ke penerbit yang dipakai. Hak cipta isi
  berita tetap milik penerbit. Penerbit yang menolak akses otomatis (mis. Tribunnews menjawab 403) tidak dipakai, dan
  aplikasi tidak berusaha menembus pemblokiran.
* **"Ramai diberitakan" = jumlah media berbeda yang memberitakan hal yang sama**, bukan jumlah pembaca. Judul dikelompokkan
  otomatis lewat kemiripan kata (`src/lib/news/cluster.ts`); hasilnya heuristik dan bisa keliru. UI menyatakan ini.
* **Postingan viral** diurutkan menurut kecepatan interaksi (`suka + 2×komentar + 3×bagikan` per jam). Skor ini tidak menilai
  benar atau tidaknya sebuah postingan. Pada mode mock, datanya **simulasi**; untuk postingan nyata dari Indonesia aktifkan
  penyedia YouTube (`DATA_PROVIDER=youtube`, `YOUTUBE_REGION=ID`). Tidak ada API resmi gratis untuk tren X/Instagram/TikTok.
* Feed di-cache 10 menit; bila semua feed gagal, hasil terakhir yang berhasil dipertahankan. Matikan sepenuhnya dengan
  `NEWS_ENABLED=false`. Sebagian penyedia hosting bisa diblokir oleh penerbit tertentu; sumber yang gagal dilewati.
* Setiap pencarian tercatat di Riwayat Aktivitas.

### API

Semua endpoint memerlukan sesi, dibatasi laju, memvalidasi input (zod), dan memeriksa `Origin` pada operasi tulis.
Respons berbentuk `{ "data": … }` atau `{ "error": "…" }`.

```text
GET  /api/posts  /api/posts/:id     GET  /api/accounts  /api/accounts/:id
GET  /api/comments                  GET  /api/issues       GET /api/toc
POST /api/analysis  /api/sentiment  /api/sna
GET  /api/cases   POST /api/cases   PATCH /api/cases/:id
GET  /api/evidence  POST /api/evidence
GET  /api/reports   POST /api/reports   GET /api/reports/:id/export?format=pdf|csv|json
GET  /api/audit     (analis: aktivitas sendiri; peninjau/admin: semua)
```

## Arsitektur

```text
UI (src/app, src/components)
  → layanan (src/lib/services)              aturan bisnis, izin, audit
  → mesin analisis (src/lib/analysis, risk, sna, toc)   fungsi murni yang diuji
  → lapisan penyedia (src/lib/providers)    antarmuka SocialMediaProvider
        MockProvider (bawaan)  |  YouTube Data API v3 (resmi)  |  lainnya menyusul
  → berita (src/lib/news)                   RSS resmi penerbit → pengelompokan → cache
```

* **Data teramati vs hasil analisis.** Penyedia hanya mengembalikan data teramati; sentimen, risiko, dan indikator
  dihitung mesin dan tidak disimpan pada rekaman (tata kelola data).
* **Risiko yang dapat dijelaskan.** `Konten 40 + Perilaku 25 + Jaringan 20 + Koordinasi 15 = 100`, dipetakan ke
  RENDAH 0–24 / SEDANG 25–49 / TINGGI 50–74 / KRITIS 75–100. Ini alat prioritas, bukan keputusan.
* **Analisis dapat diganti.** `analyzeSentiment`, `analyzeContent`, dst. dapat diganti API NLP atau model lokal tanpa
  mengubah UI. Mesin bawaan `lexicon-v1` berbasis kata kunci (Indonesia + Inggris) dan *akan* meleset pada sarkasme,
  slang, dan konteks. Karena itu tinjauan manusia wajib.
* **Tinjauan manusia tertanam.** Hanya peninjau selain analis yang dapat memverifikasi kasus atau menyetujui laporan;
  status `REPORTED` hanya dicapai dengan mencatat pengajuan; tidak ada yang diajukan otomatis.
* **Bahasa.** Nilai enum di kode, database, dan API tetap bahasa Inggris agar integrasi tidak rusak; yang diterjemahkan
  hanya tampilan (`src/lib/i18n/labels.ts`). Waktu ditampilkan dalam WIB.
* **Akurasi ToC.** Nama aturan berasal dari halaman resmi (Meta Community Standards, YouTube Community Guidelines,
  Telegram ToS) dan tetap memakai judul aslinya. X, TikTok, dan Reddit tidak dapat diambil otomatis sehingga entrinya
  **placeholder bertanda "perlu verifikasi"**. URL halaman pelaporan dicek pada 2026-09-18 (X dan Reddit memblokir bot;
  pastikan terbuka di peramban).
* **Autentikasi.** `src/proxy.ts` melakukan pengalihan cepat; pemeriksaan sesungguhnya ada di `verifySession()` /
  `requireRole()` pada setiap halaman, aksi server, dan rute API (`src/lib/auth/dal.ts`, `src/lib/api/handler.ts`).

## Penyedia data nyata

```env
DATA_PROVIDER=youtube
YOUTUBE_API_KEY=…
YOUTUBE_REGION=ID
```

YouTube Data API v3 resmi, hanya-baca; kunci dikirim lewat header, respons di-cache 5 menit untuk menghemat kuota
(`search.list` memakai 100 dari 10.000 unit harian bawaan). Jika `youtube` diminta tanpa kunci, aplikasi jatuh ke
penyedia mock yang berlabel jelas. **Belum diverifikasi terhadap API sungguhan** (tidak ada kunci saat pengembangan):
pemetaan dan penanganan error diuji dengan fixture berbentuk respons asli. Tinjau Ketentuan Layanan YouTube API sebelum
dipakai di production. Platform lain diintegrasikan satu per satu, hanya lewat API resmi dengan izin yang sesuai.

## Mode live: aplikasi yang berfungsi nyata

`APP_MODE=live` mengubah aplikasi dari demo menjadi alat kerja:

* **Tanpa data simulasi dan tanpa akun demo.** Pengguna, kasus, bukti, berkas, laporan, dan riwayat aktivitas disimpan di **PostgreSQL** (`DATABASE_URL`, mis. Supabase). Tabel dibuat otomatis di skema `thepower` dengan Row Level Security aktif.
* **Admin pertama** dari environment (`ADMIN_USERNAME` + `ADMIN_PASSWORD_HASH`); selanjutnya admin membuat pengguna di halaman **Pengguna**. Pengguna nonaktif langsung terkunci, bahkan pada sesi yang sedang berjalan.
* **Video Viral** (`/video`): tempel tautan YouTube, Instagram, Facebook, X, TikTok, atau Threads, lalu tonton lewat **pemutar resmi** masing-masing platform (dimuat hanya setelah diklik, dalam iframe ber-sandbox). Judul, penulis, dan teks diambil dari **oEmbed resmi** (YouTube, TikTok, X) atau YouTube Data API bila kunci ada. Angka yang tidak diketahui tetap "tidak diketahui" dan tidak pernah dijadikan bukti.
* **Pusat Take Down** (`/takedown`): tempel URL → kasus → bukti (snapshot ber-hash dan **berkas unggahan** ber-SHA-256) → verifikasi peninjau → laporan dengan **pemeriksaan kesiapan** → pengajuan lewat kanal resmi (oleh manusia) → catat hasil dari platform. Ada deteksi laporan ganda, pembatasan laju, ekspor PDF/CSV/JSON/Markdown/paket, dan penghapusan kasus (retensi).

Keterbatasan yang jujur: tidak ada API resmi yang gratis untuk daftar video *trending* X, Instagram, TikTok, Threads, atau Facebook, dan tidak ada API publik untuk melaporkan konten orang lain; aplikasi ini **tidak** melakukan scraping, otomatisasi form pelaporan, atau pelaporan massal. Hasil pemeriksaan "masih tayang" (YouTube/TikTok/X) hanya petunjuk untuk manusia.

Contoh menjalankan lokal dengan database:

```bash
# .env.local
APP_MODE=live
DATABASE_URL=postgresql://…
ADMIN_USERNAME=admin
ADMIN_PASSWORD_HASH='$2b$10$…'   # node -e "console.log(require('bcryptjs').hashSync('kata-sandi-anda', 10))"
AUTH_SECRET=…
npm run build && npm start
```

## Deploy: GitHub → Vercel

Di Vercel: **Add New → Project → Import** repositori, lalu isi **Environment Variables**:

| Nama | Nilai |
| --- | --- |
| `AUTH_SECRET` | 32+ karakter acak (wajib; **hasil** perintah di atas, bukan perintahnya) |
| `DEMO_MODE` | `true` agar akun demo dapat dipakai (kalau tidak, tidak ada yang bisa masuk) |
| `DEMO_PASSWORD_HASH` | hash bcrypt dari kata sandi pilihan Anda (**wajib** bersama `DEMO_MODE`) |
| `APP_MODE`, `DATABASE_URL`, `ADMIN_USERNAME`, `ADMIN_PASSWORD_HASH` | untuk mode live (lihat bagian di atas); tidak perlu `DEMO_MODE` |
| `NEWS_ENABLED` | opsional; `false` untuk mematikan pengambilan berita |
| `DATA_PROVIDER`, `YOUTUBE_API_KEY`, `YOUTUBE_REGION` | opsional, lihat di atas |

Perubahan variabel hanya berlaku pada build baru: lakukan **Redeploy** setelah mengubahnya. Vercel tidak memberi IP
publik statis. Untuk domain kustom: tambahkan di Vercel → arahkan DNS → SSL terbit otomatis.

## Keterbatasan (baca sebelum production)

* **Mode demo menyimpan di memori** (kembali ke data awal saat restart; di Vercel tidak persisten). Untuk data yang
  bertahan, pakai mode live dengan PostgreSQL.
* **Sesi berupa JWT tanpa status**: keluar hanya menghapus cookie, tetapi status aktif dan peran pengguna dicek ke
  database di setiap permintaan, jadi menonaktifkan pengguna langsung berlaku. Belum ada reset kata sandi mandiri / MFA.
* **Pembatasan laju (termasuk percobaan login) per instance server** (di memori). Untuk banyak instance, pindahkan ke
  penyimpanan bersama (mis. Redis/Upstash).
* **Berkas bukti disimpan di database** (base64, maks. 4 MB per berkas). Untuk berkas besar/banyak, pindahkan ke object storage.
* **Belum ada Content-Security-Policy** (Next.js butuh nonce untuk yang ketat). Header keamanan lain sudah diatur.
* **Basis data kebijakan bersifat baca-saja**; penyuntingan (admin, tercatat `UPDATE_POLICY`) memerlukan database.
* Penilaian di `/analysis/claims` adalah data awal baca-saja; belum ada editor penilaian.
* Mesin lexicon sengaja sederhana. Harapkan false positive/negative, terutama pada bahasa gaul dan sarkasme.
* Berita bergantung pada ketersediaan feed penerbit; pengelompokan judul bersifat heuristik.

## Tata letak proyek

```text
src/
├── app/            (app)/ = halaman terautentikasi · api/ = route handler · login/
├── components/     layout, charts, network, tables, analysis, ui
├── data/           mock-*.json (fiktif, dibuat oleh scripts/generate-mock-data.mjs)
├── lib/
│   ├── analysis/   sentimen, indikator, komentar, koordinasi, sinyal akun
│   ├── risk/       skor → tingkat, model risiko yang dapat dijelaskan
│   ├── sna/        pembuatan graf, sentralitas, komunitas, tata letak
│   ├── news/       feed RSS, parser, pengelompokan judul, layanan berita
│   ├── viral/      skor viral postingan
│   ├── toc/        pencocokan kebijakan, aturan, halaman pelaporan resmi
│   ├── workflow/   mesin status kasus/laporan (empat mata)
│   ├── providers/  antarmuka, mock, youtube
│   ├── services/   analysis, cases, evidence, reports, audit, dashboard
│   ├── i18n/       label tampilan berbahasa Indonesia
│   ├── auth/ api/ store/ reports/ evidence/ validation/ utils/
├── proxy.ts        proteksi rute optimistis
└── types/
```
