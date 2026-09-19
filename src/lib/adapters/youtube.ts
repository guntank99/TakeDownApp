import { createAdapter } from "./base";

export const youtubeAdapter = createAdapter({
  platform: "youtube",
  evidenceHints: ["Simpan URL video dan ID videonya.", "Catat menit dan detik bagian yang bermasalah.", "Tangkap layar judul, deskripsi, dan nama kanal."],
  reportSteps: ["Buka video di YouTube, klik tiga titik di bawah video lalu Laporkan.", "Untuk pelanggaran hak cipta atau privasi, gunakan formulir khusus di Pusat Bantuan YouTube."],
});
