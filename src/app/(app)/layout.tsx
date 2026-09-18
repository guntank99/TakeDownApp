import { AppShell } from "@/components/layout/AppShell";
import { verifySession } from "@/lib/auth/dal";
import { getProvider } from "@/lib/providers";

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
      {children}
    </AppShell>
  );
}
