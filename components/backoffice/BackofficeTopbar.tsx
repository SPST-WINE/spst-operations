// components/backoffice/BackofficeTopbar.tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut, LayoutDashboard } from "lucide-react";

function getPageTitle(pathname: string): string {
  if (pathname === "/back-office") return "Riepilogo operativo";
  if (pathname.startsWith("/back-office/spedizioni")) return "Gestione spedizioni";
  if (pathname.startsWith("/back-office/quotazioni")) return "Preventivi & quotazioni";
  return "Back office";
}

export default function BackofficeTopbar() {
  const pathname = usePathname() || "/back-office";
  const title = getPageTitle(pathname);

  return (
    <header className="flex h-14 items-center justify-between border-b bg-white px-6">
      <div className="flex flex-col">
        <span className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
          SPST • Back office
        </span>
        <span className="text-sm font-semibold text-slate-800">
          {title}
        </span>
      </div>

      <div className="flex items-center gap-2 text-xs">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1 rounded-lg border px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50"
        >
          <LayoutDashboard className="h-3.5 w-3.5" />
          Area clienti
        </Link>
        <Link
          href="/logout"
          className="inline-flex items-center gap-1 rounded-lg bg-slate-900 px-3 py-1.5 text-xs text-white hover:opacity-90"
        >
          <LogOut className="h-3.5 w-3.5" />
          Logout
        </Link>
      </div>
    </header>
  );
}
