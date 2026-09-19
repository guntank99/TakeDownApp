import type { Metadata } from "next";
import { createUserAction, resetPasswordAction, updateUserAction } from "@/app/(app)/actions";
import { Badge } from "@/components/ui/badges";
import { DataTable } from "@/components/tables/DataTable";
import { Card, Flash, Notice, PageHeader } from "@/components/ui/layout";
import { requireRole } from "@/lib/auth/dal";
import { ROLE_LABELS } from "@/lib/auth/roles";
import { listUsersSafe } from "@/lib/auth/user-store";
import { appMode } from "@/lib/config/mode";
import { MIN_PASSWORD } from "@/lib/services/users";
import { formatDateTime } from "@/lib/utils/format";
import type { Role } from "@/types";

export const metadata: Metadata = { title: "Pengguna" };

const ROLES = Object.keys(ROLE_LABELS) as Role[];
const field = "w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500";
const btn = "rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-200 hover:bg-slate-800";

export default async function UsersPage({ searchParams }: PageProps<"/users">) {
  const me = await requireRole("admin");
  const sp = await searchParams;
  const users = await listUsersSafe();
  const readOnly = appMode() === "demo";

  return (
    <div className="space-y-6">
      <PageHeader title="Pengguna" description="Kelola siapa yang dapat masuk dan apa yang boleh dilakukannya. Hanya administrator." mock={false} />
      <Flash searchParams={sp} />

      {readOnly ? (
        <Notice tone="warning">
          Mode demo: akun berikut adalah akun contoh dan tidak dapat diubah. Atur <code>APP_MODE=live</code> dan <code>DATABASE_URL</code> untuk mengelola pengguna nyata.
        </Notice>
      ) : null}

      <Card title={`Daftar pengguna (${users.length})`}>
        <DataTable
          caption="Pengguna"
          rows={users}
          rowKey={(u) => u.id}
          columns={[
            { header: "Nama", cell: (u) => <span>{u.name}{u.id === me.id ? <span className="ml-2 text-xs text-slate-500">(Anda)</span> : null}</span> },
            { header: "Nama pengguna", cell: (u) => u.username },
            { header: "Email", cell: (u) => u.email },
            {
              header: "Peran",
              cell: (u) =>
                readOnly ? ROLE_LABELS[u.role] : (
                  <form action={updateUserAction} className="flex items-center gap-2">
                    <input type="hidden" name="userId" value={u.id} />
                    <label htmlFor={`role-${u.id}`} className="sr-only">Peran {u.name}</label>
                    <select id={`role-${u.id}`} name="role" defaultValue={u.role} className="rounded-lg border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-slate-100">
                      {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
                    </select>
                    <button type="submit" className={btn}>Ubah</button>
                  </form>
                ),
            },
            { header: "Status", cell: (u) => (u.active ? <Badge tone="success">AKTIF</Badge> : <Badge tone="danger">NONAKTIF</Badge>) },
            { header: "Dibuat", className: "whitespace-nowrap", cell: (u) => formatDateTime(u.createdAt) },
            {
              header: "Tindakan",
              cell: (u) =>
                readOnly ? "—" : (
                  <div className="flex flex-wrap items-center gap-2">
                    <form action={updateUserAction}>
                      <input type="hidden" name="userId" value={u.id} />
                      <input type="hidden" name="active" value={u.active ? "false" : "true"} />
                      <button type="submit" className={btn}>{u.active ? "Nonaktifkan" : "Aktifkan"}</button>
                    </form>
                    <form action={resetPasswordAction} className="flex items-center gap-2">
                      <input type="hidden" name="userId" value={u.id} />
                      <label htmlFor={`pw-${u.id}`} className="sr-only">Kata sandi baru untuk {u.name}</label>
                      <input id={`pw-${u.id}`} name="password" type="password" autoComplete="new-password" minLength={MIN_PASSWORD} maxLength={128} required placeholder="Kata sandi baru" className="w-36 rounded-lg border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-slate-100" />
                      <button type="submit" className={btn}>Ganti</button>
                    </form>
                  </div>
                ),
            },
          ]}
        />
      </Card>

      {!readOnly ? (
        <Card title="Tambah pengguna" description={`Kata sandi minimal ${MIN_PASSWORD} karakter. Sampaikan kata sandi awal lewat saluran yang aman; pengguna dapat menggantinya di Pengaturan.`}>
          <form action={createUserAction} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <label htmlFor="u-name" className="mb-1 block text-xs text-slate-400">Nama lengkap</label>
              <input id="u-name" name="name" required minLength={2} maxLength={80} className={field} />
            </div>
            <div>
              <label htmlFor="u-username" className="mb-1 block text-xs text-slate-400">Nama pengguna</label>
              <input id="u-username" name="username" required pattern="[A-Za-z0-9._\-]{3,32}" title="3–32 karakter: huruf, angka, titik, garis" autoComplete="off" className={field} />
            </div>
            <div>
              <label htmlFor="u-email" className="mb-1 block text-xs text-slate-400">Email</label>
              <input id="u-email" name="email" type="email" required maxLength={254} className={field} />
            </div>
            <div>
              <label htmlFor="u-role" className="mb-1 block text-xs text-slate-400">Peran</label>
              <select id="u-role" name="role" defaultValue="analyst" className={field}>
                {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="u-password" className="mb-1 block text-xs text-slate-400">Kata sandi awal</label>
              <input id="u-password" name="password" type="password" required minLength={MIN_PASSWORD} maxLength={128} autoComplete="new-password" className={field} />
            </div>
            <div className="flex items-end">
              <button type="submit" className="rounded-lg bg-sky-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-sky-400">Tambah pengguna</button>
            </div>
          </form>
        </Card>
      ) : null}
    </div>
  );
}
