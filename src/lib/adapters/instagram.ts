import { createAdapter } from "./base";

export const instagramAdapter = createAdapter({
  platform: "instagram",
  evidenceHints: ["Simpan URL postingan/reel.", "Tangkap layar postingan, akun, dan keterangan.", "Instagram tidak menyediakan metadata otomatis: salin keterangannya secara manual."],
  reportSteps: ["Buka postingan di aplikasi/situs Instagram, ketuk tiga titik lalu Laporkan.", "Untuk peniruan identitas atau hak cipta, gunakan formulir di Pusat Bantuan Instagram."],
});
