// components/AppTopbar.tsx
'use client';

import { usePathname } from 'next/navigation';
import { LogOut } from 'lucide-react';

type RouteItem = { href: string; label: string };

const routes: RouteItem[] = [
  { href: '/dashboard/spedizioni', label: 'Le mie spedizioni' },
  { href: '/dashboard/nuova', label: 'Nuova spedizione' },
  { href: '/dashboard/quotazioni', label: 'Quotazioni' },
  { href: '/dashboard/quotazioni/nuova', label: 'Nuova quotazione' },
  { href: '/dashboard/informazioni-utili', label: 'Informazioni utili' },
  { href: '/dashboard/impostazioni', label: 'Impostazioni' },
  { href: '/dashboard', label: 'Overview' },
];

function titleFor(path: string) {
  const match = routes
    .filter(r => path === r.href || path.startsWith(r.href + '/'))
    .sort((a, b) => b.href.length - a.href.length)[0];

  if (!match && path === '/dashboard') return 'Overview';
  return match?.label ?? 'Dashboard';
}

/* Icona WhatsApp (SVG inline, no dipendenze esterne) */
function WhatsAppIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      {...props}
    >
      <path d="M20.52 3.48A11.91 11.91 0 0 0 12.04 0C5.41 0 .02 5.39.02 12.02c0 2.12.55 4.19 1.6 6.01L0 24l6.15-1.6a11.95 11.95 0 0 0 5.9 1.5h.01c6.63 0 12.02-5.39 12.02-12.02a11.9 11.9 0 0 0-3.56-8.4zM12.06 21.9h-.01a9.9 9.9 0 0 1-5.04-1.38l-.36-.21-3.65.95.97-3.56-.24-.37a9.9 9.9 0 1 1 8.33 4.57zm5.43-7.41c-.3-.15-1.77-.87-2.04-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.95 1.17-.17.2-.35.22-.65.07-.3-.15-1.25-.46-2.38-1.47-.88-.78-1.48-1.74-1.65-2.03-.17-.3-.02-.46.13-.61.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.07-.15-.67-1.62-.92-2.22-.24-.58-.48-.5-.67-.51h-.57c-.2 0-.52.07-.8.37-.27.3-1.05 1.03-1.05 2.52 0 1.5 1.08 2.94 1.23 3.14.15.2 2.13 3.26 5.16 4.57.72.31 1.28.5 1.72.64.72.23 1.37.2 1.88.12.57-.08 1.77-.72 2.02-1.42.25-.7.25-1.3.17-1.42-.07-.12-.27-.2-.57-.35z" />
    </svg>
  );
}

export default function AppTopbar() {
  const pathname = usePathname();
  const title = titleFor(pathname);

  const whatsappUrl =
    process.env.NEXT_PUBLIC_WHATSAPP_LINK ||
    'https://wa.me/message/CP62RMFFDNZPO1';

  return (
    <header className="sticky top-0 z-30 border-b bg-white/80 backdrop-blur">
      <div className="mx-auto flex h-14 items-center justify-between px-4">
        <h1 className="text-sm font-semibold tracking-tight text-slate-900">
          {title}
        </h1>

        <div className="flex items-center gap-2">
          {/* WhatsApp */}
          <a
            href={whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-lg bg-[#25D366] px-3 py-1.5 text-sm font-medium text-white shadow-sm transition hover:bg-[#1ebe5d] focus:outline-none focus:ring-2 focus:ring-[#25D366]/40"
          >
            <WhatsAppIcon className="h-4 w-4" />
            Supporto WhatsApp
          </a>

          {/* Logout */}
          <a
            href="/logout"
            className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-3 py-1.5 text-sm font-medium text-white shadow-sm transition hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-900/40"
          >
            <LogOut size={16} />
            Logout
          </a>
        </div>
      </div>
    </header>
  );
}
