import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { getCurrentUser } from "@/lib/auth/dal";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = { title: "Masuk" };

export default async function LoginPage() {
  // Checks the user really exists, not just that a cookie is present, so a
  // stale cookie cannot cause a redirect loop with the protected pages.
  if (await getCurrentUser()) redirect("/dashboard");

  return (
    <main className="flex flex-1 items-center justify-center p-4">
      <div className="w-full max-w-sm rounded-2xl border border-slate-800 bg-slate-900/70 p-8 shadow-xl">
        <div className="mb-6 text-center">
          <ShieldCheck
            className="mx-auto size-9 text-sky-400"
            aria-hidden="true"
          />
          <h1 className="mt-3 text-lg font-semibold tracking-wide text-slate-50">
            THE POWER
          </h1>
          <p className="mt-1 text-xs text-slate-400">
            Pantau • Analisis • Verifikasi • Dokumentasikan • Laporkan
          </p>
        </div>

        <LoginForm />

        <p className="mt-6 text-center text-xs text-slate-500">
          Versi prototipe. Hanya akun demo dan data simulasi.
        </p>
      </div>
    </main>
  );
}
