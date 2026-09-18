"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_ITEMS } from "./nav-items";

interface SidebarProps {
  collapsed: boolean;
  onNavigate?: () => void;
}

export function Sidebar({ collapsed, onNavigate }: SidebarProps) {
  const pathname = usePathname();

  return (
    <nav aria-label="Main navigation" className="flex-1 overflow-y-auto p-3">
      <ul className="space-y-1">
        {NAV_ITEMS.map(({ label, href, icon: Icon, enabled }) => {
          const base =
            "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors";
          const content = (
            <>
              <Icon className="size-4 shrink-0" aria-hidden="true" />
              <span className={collapsed ? "sr-only" : "flex-1 truncate"}>
                {label}
              </span>
              {!enabled && !collapsed ? (
                <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-slate-500">
                  Soon
                </span>
              ) : null}
            </>
          );

          if (!enabled) {
            return (
              <li key={href}>
                <span
                  aria-disabled="true"
                  title={`${label} — coming in a later step`}
                  className={`${base} cursor-not-allowed text-slate-600`}
                >
                  {content}
                </span>
              </li>
            );
          }

          const active = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <li key={href}>
              <Link
                href={href}
                onClick={onNavigate}
                aria-current={active ? "page" : undefined}
                title={collapsed ? label : undefined}
                className={`${base} ${
                  active
                    ? "bg-sky-500/10 text-sky-300"
                    : "text-slate-300 hover:bg-slate-800 hover:text-slate-50"
                }`}
              >
                {content}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
