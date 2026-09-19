import { createAdapter } from "./base";

export const tiktokAdapter = createAdapter({
  platform: "tiktok",
  evidenceHints: ["Simpan URL lengkap video (bukan tautan pendek vm.tiktok.com).", "Tangkap layar video, nama akun, dan keterangan.", "Catat ID videonya (angka panjang di URL)."],
  reportSteps: ["Buka video di TikTok, ketuk Bagikan lalu Laporkan.", "Untuk pelanggaran hak cipta, gunakan formulir hak cipta TikTok."],
});
