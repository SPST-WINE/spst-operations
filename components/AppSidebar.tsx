// components/AppSidebar.tsx
'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Home,
  Package,
  FileText,
  ShieldCheck,
  Settings,
  Info,
  ReceiptText,
  FilePlus2,
} from 'lucide-react';

type NavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  // overview (e altri) possono richiedere match esatto
  exact?: boolean;
};

const NAV: NavItem[] = [
  { href: '/dashboard', label: 'Overview', icon: Home, exact: true },
  { href: '/dashboard/spedizioni', label: 'Le mie spedizioni', icon: Package },
  { href: '/dashboard/nuova', label: 'Nuova spedizione', icon: FileText },
  { href: '/dashboard/quotazioni', label: 'Quotazioni', icon: ReceiptText },
  { href: '/dashboard/quotazioni/nuova', label: 'Nuova quotazione', icon: FilePlus2 },
  { href: '/dashboard/impostazioni', label: 'Impostazioni', icon: Settings },
  { href: '/dashboard/informazioni-utili', label: 'Informazioni utili', icon: Info },
];

export default function AppSidebar() {
  const pathname = usePathname();

  return (
    <aside className="sticky top-0 h-screen border-r bg-white">
      {/* Header con logo */}
      <div className="flex items-center gap-3 px-4 py-4">
        <Image
          src="/spst-logo.png"
          alt="SPST"
          width={24}
          height={24}
          priority
        />
        <span className="text-sm font-medium text-slate-700">Area Riservata</span>
      </div>

      {/* Navigazione */}
      <nav className="mt-2 space-y-1 px-2">
        {NAV.map(({ href, label, icon: Icon, exact }) => {
          let isActive: boolean;

          if (href === '/dashboard/quotazioni') {
            // Attivo su /dashboard/quotazioni e su eventuali sotto-pagine,
            // ma NON su /dashboard/quotazioni/nuova
            isActive =
              pathname === '/dashboard/quotazioni' ||
              (pathname.startsWith('/dashboard/quotazioni/') &&
                !pathname.startsWith('/dashboard/quotazioni/nuova'));
          } else if (href === '/dashboard/quotazioni/nuova') {
            // Attivo solo sulla pagina "nuova quotazione"
            isActive = pathname === '/dashboard/quotazioni/nuova';
          } else {
            // Logica generica per gli altri item
            isActive = exact
              ? pathname === href
              : pathname === href || pathname.startsWith(href + '/');
          }

          return (
            <Link
              key={href}
              href={href}
              className={[
                'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
                isActive
                  ? 'bg-[#1c3e5e] text-white shadow-sm'
                  : 'text-slate-600 hover:bg-slate-100',
              ].join(' ')}
              aria-current={isActive ? 'page' : undefined}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span>{label}</span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
