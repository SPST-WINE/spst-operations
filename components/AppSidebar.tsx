// components/AppSidebar.tsx
'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Home,
  Package,
  FileText,
  Settings,
  Info,
  ReceiptText,
  FilePlus2,
  ArrowRight,
} from 'lucide-react';

type NavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  exact?: boolean;

  // ✅ look “Wine Connect-like”
  imageSrc: string;   // foto in sottoimpressione (metti i tuoi asset)
  accentHex: string;  // glow/outline dell’active
};

const NAV: NavItem[] = [
  {
    href: '/dashboard',
    label: 'Overview',
    icon: Home,
    exact: true,
    imageSrc: '/images/sidebar/overview.jpg',
    accentHex: '#1c3e5e',
  },
  {
    href: '/dashboard/spedizioni',
    label: 'Le mie spedizioni',
    icon: Package,
    imageSrc: '/images/sidebar/spedizioni.jpg',
    accentHex: '#E33854',
  },
  {
    href: '/dashboard/nuova',
    label: 'Nuova spedizione',
    icon: FileText,
    imageSrc: '/images/sidebar/nuova.jpg',
    accentHex: '#22c55e',
  },
  {
    href: '/dashboard/quotazioni',
    label: 'Quotazioni',
    icon: ReceiptText,
    imageSrc: '/images/sidebar/quotazioni.jpg',
    accentHex: '#f59e0b',
  },
  {
    href: '/dashboard/quotazioni/nuova',
    label: 'Nuova quotazione',
    icon: FilePlus2,
    imageSrc: '/images/sidebar/nuova-quotazione.jpg',
    accentHex: '#a855f7',
  },
  {
    href: '/dashboard/impostazioni',
    label: 'Impostazioni',
    icon: Settings,
    imageSrc: '/images/sidebar/impostazioni.jpg',
    accentHex: '#64748b',
  },
  {
    href: '/dashboard/informazioni-utili',
    label: 'Informazioni utili',
    icon: Info,
    imageSrc: '/images/sidebar/info.jpg',
    accentHex: '#0ea5e9',
  },
];

function hexToRgba(hex: string, alpha: number) {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

export default function AppSidebar() {
  const pathname = usePathname();

  return (
    <aside className="sticky top-0 h-screen border-r bg-white">
      {/* Header con logo */}
      <div className="flex items-center gap-3 px-4 py-4">
        <Image src="/spst-logo.png" alt="SPST" width={24} height={24} priority />
        <span className="text-sm font-medium text-slate-700">Area Riservata</span>
      </div>

      {/* Navigazione */}
      <nav className="mt-2 space-y-2 px-3">
        {NAV.map(({ href, label, icon: Icon, exact, imageSrc, accentHex }) => {
          let isActive: boolean;

          if (href === '/dashboard/quotazioni') {
            isActive =
              pathname === '/dashboard/quotazioni' ||
              (pathname.startsWith('/dashboard/quotazioni/') &&
                !pathname.startsWith('/dashboard/quotazioni/nuova'));
          } else if (href === '/dashboard/quotazioni/nuova') {
            isActive = pathname === '/dashboard/quotazioni/nuova';
          } else {
            isActive = exact
              ? pathname === href
              : pathname === href || pathname.startsWith(href + '/');
          }

          // dim: se sei dentro una sezione, gli altri si “abbassano”
          const inSection = NAV.some((n) =>
            n.exact ? pathname === n.href : pathname === n.href || pathname.startsWith(n.href + '/')
          );
          const shouldDim = inSection && !isActive;

          return (
            <Link
              key={href}
              href={href}
              aria-current={isActive ? 'page' : undefined}
              className={[
                'group relative w-full overflow-hidden text-left',
                'rounded-[18px] border',
                'transition-all',
                'h-[64px] px-3', // ✅ più alte (Y)
                'flex items-center justify-between gap-3',
                isActive
                  ? 'border-slate-200 bg-white shadow-[0_12px_28px_rgba(148,163,184,0.18)]'
                  : 'border-slate-200 bg-white hover:-translate-y-[1px] hover:shadow-[0_12px_28px_rgba(148,163,184,0.16)]',
                shouldDim ? 'opacity-50' : 'opacity-100',
              ].join(' ')}
              style={
                isActive
                  ? {
                      boxShadow: `0 0 0 2px ${hexToRgba(
                        accentHex,
                        0.65
                      )}, 0 14px 34px rgba(148,163,184,0.22)`,
                    }
                  : undefined
              }
            >
              {/* Background image (sottoimpressione) */}
              <div className="absolute inset-0">
                <Image
                  src={imageSrc}
                  alt=""
                  fill
                  sizes="260px"
                  className="object-cover opacity-[0.32] transition-transform duration-500 group-hover:scale-[1.03] transform-gpu"
                  style={{ objectPosition: 'center 35%' }}
                  priority={false}
                />
                {/* overlay leggibile */}
                <div className="absolute inset-0 bg-gradient-to-r from-black/65 via-black/35 to-black/10" />
                {/* glow accent */}
                <div
                  className="absolute inset-0"
                  style={{
                    background: `radial-gradient(95% 120% at 18% 50%, ${hexToRgba(
                      accentHex,
                      0.22
                    )} 0%, rgba(0,0,0,0) 62%)`,
                  }}
                />
              </div>

              {/* Content */}
              <div className="relative flex items-center gap-3 min-w-0">
                <div
                  className={[
                    'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border',
                    'bg-white/95 shadow-sm transition-all',
                    isActive ? 'border-white/60' : 'border-white/50',
                    'group-hover:shadow-md',
                  ].join(' ')}
                  style={{ color: accentHex }}
                >
                  <Icon className="h-4 w-4" />
                </div>

                <div className="min-w-0">
                  <div
                    className="text-[12px] font-semibold text-white truncate"
                    style={{ textShadow: '0 10px 22px rgba(0,0,0,0.55)' }}
                  >
                    {label}
                  </div>

                  {/* sottotitolo minimale (senza “selected”) */}
                  <div
                    className={[
                      'mt-0.5 text-[10px] text-white/80 truncate',
                      isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-100',
                      'transition-opacity',
                    ].join(' ')}
                    style={{ textShadow: '0 10px 22px rgba(0,0,0,0.55)' }}
                  >
                    Apri sezione
                  </div>
                </div>
              </div>

              {/* CTA bubble */}
              <div
                className="relative shrink-0 rounded-full border border-white/60 bg-white p-2 shadow-sm transition-shadow group-hover:shadow-md"
                style={{ color: accentHex }}
              >
                <ArrowRight className="h-4 w-4" />
              </div>
            </Link>
          );
        })}
      </nav>

      {/* footer soft (facoltativo) */}
      <div className="mt-6 px-4 text-[11px] text-slate-400">
        © {new Date().getFullYear()} SPST
      </div>
    </aside>
  );
}
