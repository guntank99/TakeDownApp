import { createAdapter } from "./base";

export const threadsAdapter = createAdapter({
  platform: "threads",
  evidenceHints: ["Simpan URL postingan dan nama akun.", "Tangkap layar teks postingan dan balasan terkait.", "Threads tidak menyediakan metadata otomatis: salin teksnya secara manual."],
  reportSteps: ["Buka postingan di Threads, ketuk tiga titik lalu Laporkan.", "Threads dikelola Meta, jadi kebijakannya mengikuti Standar Komunitas Meta."],
});
