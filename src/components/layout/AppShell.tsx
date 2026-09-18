"use client";

import { useState } from "react";
import {
  LogOut,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  ShieldCheck,
  X,
} from "lucide-react";
import { logout } from "@/lib/auth/actions";
import { ROLE_LABELS } from "@/lib/auth/roles";
import type { SessionUser } from "@/types";
import { MockDataBadge } from "@/components/ui/MockDataBadge";
import { Sidebar } from "./Sidebar";

function Brand() {
  return (
    <div className="flex items-center gap-2">
      <ShieldCheck className="size-6 text-sky-400" aria-hidden="true" />
      <span className="text-sm font-semibold tracking-wide text-slate-50">
        SOCIAL SENTINEL
      </span>
    </div>
  );
}

export function AppShell({
  user,
  isMock,
  children,
}: {
  user: SessionUser;
  /** Driven by the active provider so the badge can never claim data is simulated when it is not. */
  isMock: boolean;
  children: React.ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex min-h-screen">
      {/* Desktop sidebar */}
      <aside
        className={`hidden shrink-0 flex-col border-r border-slate-800 bg-slate-950 transition-[width] duration-200 lg:flex ${
          collapsed ? "w-16" : "w-60"
        }`}
      >
        <div className="flex h-14 items-center border-b border-slate-800 px-4">
          {collapsed ? (
            <ShieldCheck className="size-6 text-sky-400" aria-label="Social Sentinel" />
          ) : (
            <Brand />
          )}
        </div>
        <Sidebar collapsed={collapsed} />
      </aside>

      {/* Mobile drawer */}
      {mobileOpen ? (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div
            className="absolute inset-0 bg-black/60"
            onClick={() => setMobileOpen(false)}
            aria-hidden="true"
          />
          <aside className="absolute inset-y-0 left-0 flex w-64 flex-col border-r border-slate-800 bg-slate-950">
            <div className="flex h-14 items-center justify-between border-b border-slate-800 px-4">
              <Brand />
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                aria-label="Close navigation"
                className="rounded-md p-1.5 text-slate-400 hover:bg-slate-800 hover:text-slate-50"
              >
                <X className="size-5" aria-hidden="true" />
              </button>
            </div>
            <Sidebar collapsed={false} onNavigate={() => setMobileOpen(false)} />
          </aside>
        </div>
      ) : null}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 items-center gap-3 border-b border-slate-800 bg-slate-950/80 px-4 backdrop-blur">
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            aria-label="Open navigation"
            className="rounded-md p-1.5 text-slate-400 hover:bg-slate-800 hover:text-slate-50 lg:hidden"
          >
            <Menu className="size-5" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => setCollapsed((c) => !c)}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            aria-pressed={collapsed}
            className="hidden rounded-md p-1.5 text-slate-400 hover:bg-slate-800 hover:text-slate-50 lg:block"
          >
            {collapsed ? (
              <PanelLeftOpen className="size-5" aria-hidden="true" />
            ) : (
              <PanelLeftClose className="size-5" aria-hidden="true" />
            )}
          </button>

          <form action="/search" method="get" role="search" className="relative hidden max-w-md flex-1 md:block">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-500"
              aria-hidden="true"
            />
            <input
              type="search"
              name="q"
              required
              maxLength={200}
              aria-label="Global search"
              placeholder="Search keyword, hashtag, username, URL..."
              className="w-full rounded-lg border border-slate-800 bg-slate-900 py-1.5 pl-9 pr-3 text-sm text-slate-100 placeholder:text-slate-500 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
            />
          </form>

          <div className="ml-auto flex items-center gap-3">
            {isMock ? <MockDataBadge /> : null}
            <div className="hidden text-right sm:block">
              <p className="text-sm font-medium leading-tight text-slate-100">
                {user.name}
              </p>
              <p className="text-xs leading-tight text-slate-500">
                {ROLE_LABELS[user.role]}
              </p>
            </div>
            <form action={logout}>
              <button
                type="submit"
                className="flex items-center gap-1.5 rounded-lg border border-slate-800 px-3 py-1.5 text-sm text-slate-300 transition-colors hover:bg-slate-800 hover:text-slate-50"
              >
                <LogOut className="size-4" aria-hidden="true" />
                <span className="hidden sm:inline">Logout</span>
                <span className="sr-only sm:hidden">Logout</span>
              </button>
            </form>
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6">{children}</main>
      </div>
    </div>
  );
}
