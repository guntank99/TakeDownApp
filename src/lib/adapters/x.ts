import { createAdapter } from "./base";

export const xAdapter = createAdapter({
  platform: "x",
  evidenceHints: ["Simpan URL postingan dan nama pengguna.", "Tangkap layar postingan, tanggal, dan nama akun.", "Teks postingan diambil otomatis dari oEmbed resmi X saat tautan ditambahkan."],
  reportSteps: ["Buka postingan di X, klik tiga titik lalu Laporkan postingan.", "Untuk hak cipta atau merek dagang, gunakan formulir khusus di Pusat Bantuan X."],
});
