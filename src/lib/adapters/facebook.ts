import { createAdapter } from "./base";

export const facebookAdapter = createAdapter({
  platform: "facebook",
  evidenceHints: ["Simpan URL postingan dan nama halaman/profil.", "Tangkap layar postingan lengkap dengan tanggal.", "Postingan pribadi/privat tidak dapat dilihat aplikasi ini."],
  reportSteps: ["Buka postingan di Facebook, klik tiga titik lalu Cari dukungan atau laporkan postingan.", "Untuk konten yang melanggar hukum atau hak cipta, gunakan formulir khusus di Pusat Bantuan Facebook."],
});
