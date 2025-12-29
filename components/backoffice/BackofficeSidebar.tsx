"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  Package,
  FileText,
  FileCheck,
  Wrench,
  Truck,
  PlusCircle,
  Link2,
} from "lucide-react";

type NavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  exact?: boolean;
};

const navItems: NavItem[] = [
  {
    href: "/back-office",
    label: "Riepilogo",
    icon: Home,
    exact: true,
  },
  {
    href: "/back-office/spedizioni",
    label: "Spedizioni clienti",
    icon: Package,
  },

  // ✅ NEW: Update status
  {
    href: "/back-office/status",
    label: "Update status",
    icon: Truck,
  },

  {
    href: "/back-office/nuova-spedizione",
    label: "Crea spedizione",
    icon: PlusCircle,
  },
  {
    href: "/back-office/quotazioni",
    label: "Quotazioni",
    icon: FileText,
  },
  {
    href: "/back-office/edas",
    label: "e-DAS",
    icon: FileCheck,
  },
  {
    href: "/back-office/utility-documenti",
    label: "Utility documenti",
    icon: Wrench,
  },
  {
    href: "/back-office/pallet",
    label: "SPST Pallet",
    icon: Truck,
  },
  {
    href: "/back-office/link-utili",
    label: "Link utili",
    icon: Link2,
  },
];

function cn(...a: Array<string | false | null | undefined>) {
  return a.filter(Boolean).join(" ");
}

function isActive(pathname: string, item: NavItem) {
  if (item.exact) return pathname === item.href;
  return pathname === item.href || pathname.startsWith(item.href + "/");
}

export default function BackofficeSidebar() {
  const pathname = usePathname() || "/back-office";

  return (
    <aside className="border-r bg-white">
      <div className="flex h-16 items-center gap-3 border-b px-4">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100">
          <Image
            src="/spst-logo.png"
            alt="SPST"
            width={22}
            height={22}
            className="object-contain"
          />
        </div>
        <div className="flex flex-col">
          <span className="text-sm font-semibold text-slate-900">SPST</span>
          <span className="text-xs text-slate-500">Back office</span>
        </div>
      </div>

      <nav className="mt-4 space-y-1 px-3">
        {navItems.map((item) => {
          const active = isActive(pathname, item);
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors",
                active
                  ? "bg-slate-900 text-white"
                  : "text-slate-700 hover:bg-slate-100"
              )}
            >
              <Icon className="h-4 w-4" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
