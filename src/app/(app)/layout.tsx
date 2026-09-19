import { AppShell } from "@/components/layout/AppShell";
import { verifySession } from "@/lib/auth/dal";
import { Notice } from "@/components/ui/layout";
import { getProvider } from "@/lib/providers";
import { storageIsVolatile } from "@/lib/store";

/**
 * Route group for every authenticated page. "(app)" does not appear in the
 * URL: /dashboard stays /dashboard. Pages must still call verifySession()
 * themselves, because layouts are not re-rendered on client-side navigation.
 */
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await verifySession();
  return (
    <AppShell user={user} isMock={getProvider().isMock}>
      {storageIsVolatile() ? (
        <div className="mb-4">
          <Notice tone="warning">
            Mode live berjalan <strong>tanpa database</strong> (DATABASE_URL belum diatur): kasus, bukti, laporan, dan tautan yang Anda tambahkan akan hilang saat server restart.
            Hubungkan PostgreSQL agar data tersimpan permanen.
          </Notice>
        </div>
      ) : null}
      {children}
    </AppShell>
  );
}
