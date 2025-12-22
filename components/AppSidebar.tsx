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
  desc: string;
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  exact?: boolean;
  imageSrc: string;
  accentHex: string;
};

const NAV: NavItem[] = [
  {
    href: '/dashboard',
    label: 'Overview',
    desc: 'Il pannello di controllo',
    icon: Home,
    exact: true,
    imageSrc: '/images/sidebar/overview.jpg',
    accentHex: '#1c3e5e',
  },
  {
    href: '/dashboard/spedizioni',
    label: 'Le mie spedizioni',
    desc: 'Documenti e allegati',
    icon: Package,
    imageSrc: '/images/sidebar/spedizioni.jpg',
    accentHex: '#E33854',
  },
  {
    href: '/dashboard/nuova',
    label: 'Nuova spedizione',
    desc: 'Spedisci ora',
    icon: FileText,
    imageSrc: '/images/sidebar/nuova.jpg',
    accentHex: '#22c55e',
  },
  {
    href: '/dashboard/quotazioni',
    label: 'Quotazioni',
    desc: 'Visualizza i preventivi',
    icon: ReceiptText,
    imageSrc: '/images/sidebar/quotazioni.jpg',
    accentHex: '#f59e0b',
  },
  {
    href: '/dashboard/quotazioni/nuova',
    label: 'Nuova quotazione',
    desc: 'Richiedi un preventivo',
    icon: FilePlus2,
    imageSrc: '/images/sidebar/nuova-quotazione.jpg',
    accentHex: '#a855f7',
  },
  {
    href: '/dashboard/impostazioni',
    label: 'Impostazioni',
    desc: 'Imposta mittente',
    icon: Settings,
    imageSrc: '/images/sidebar/impostazioni.jpg',
    accentHex: '#64748b',
  },
  {
    href: '/dashboard/informazioni-utili',
    label: 'Informazioni utili',
    desc: 'Se hai dubbi, clicca',
    icon: Info,
    imageSrc: '/images/sidebar/info.jpg',
    accentHex: '#0ea5e9',
  },
];

function hexToRgba(hex: string, alpha: number) {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map(c => c + c).join('') : h;
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

export default function AppSidebar() {
  const pathname = usePathname();

  function isActiveFor(href: string, exact?: boolean) {
    if (href === '/dashboard/quotazioni') {
      return (
        pathname === '/dashboard/quotazioni' ||
        (pathname.startsWith('/dashboard/quotazioni/') &&
          !pathname.startsWith('/dashboard/quotazioni/nuova'))
      );
    }
    if (href === '/dashboard/quotazioni/nuova') {
      return pathname === '/dashboard/quotazioni/nuova';
    }
    return exact
      ? pathname === href
      : pathname === href || pathname.startsWith(href + '/');
  }

  const anyActive = NAV.some(n => isActiveFor(n.href, n.exact));

  return (
    <aside className="sticky top-0 h-screen border-r bg-white">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-4">
        <Image src="/spst-logo.png" alt="SPST" width={24} height={24} priority />
        <span className="text-sm font-medium text-slate-700">Area Riservata</span>
      </div>

      <nav className="px-3 pb-4" style={{ height: 'calc(100vh - 64px)' }}>
        <div className="h-full flex flex-col gap-2 pt-3">
          {NAV.map(({ href, label, desc, icon: Icon, exact, imageSrc, accentHex }) => {
            const isActive = isActiveFor(href, exact);
            const shouldDim = anyActive && !isActive;

            return (
              <Link
                key={href}
                href={href}
                aria-current={isActive ? 'page' : undefined}
                className={[
                  'group relative isolate w-full overflow-hidden rounded-[18px]',
                  'flex flex-1 items-center justify-between gap-3 px-3',
                  'transition-all hover:-translate-y-[1px]',
                  shouldDim ? 'opacity-55' : 'opacity-100',
                ].join(' ')}
                style={{
                  backgroundColor: '#ffffff',
                  border: '1px solid rgba(0,0,0,0.08)',
                  boxShadow: isActive
                    ? `0 0 0 2px ${hexToRgba(accentHex, 0.55)}, 0 20px 46px rgba(0,0,0,0.35)`
                    : '0 16px 36px rgba(0,0,0,0.28)',
                }}
              >
                {/* Background image + DARK overlay */}
                <div className="absolute inset-0">
                  <Image
                    src={imageSrc}
                    alt=""
                    fill
                    sizes="260px"
                    className="object-cover opacity-[0.22] transition-transform duration-500 group-hover:scale-[1.04]"
                    style={{ objectPosition: 'center 35%' }}
                  />

                  {/* overlay più scuro */}
                  <div className="absolute inset-0 bg-black/75" />

                  {/* accent glow */}
                  <div
                    className="absolute inset-0"
                    style={{
                      background: `radial-gradient(90% 120% at 18% 50%, ${hexToRgba(
                        accentHex,
                        0.30
                      )} 0%, rgba(0,0,0,0) 62%)`,
                    }}
                  />

                  {/* vignetta interna marcata */}
                  <div className="absolute inset-0 shadow-[inset_0_-90px_140px_rgba(0,0,0,0.65)]" />
                </div>

                {/* Content */}
                <div className="relative flex items-center gap-3 min-w-0 py-3">
                  <div
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border bg-white shadow-sm"
                    style={{
                      color: accentHex,
                      borderColor: 'rgba(255,255,255,0.55)',
                    }}
                  >
                    <Icon className="h-4 w-4" />
                  </div>

                  <div className="min-w-0">
                    <div className="text-[12px] font-semibold text-white truncate">
                      {label}
                    </div>

                    <div
                      className={[
                        'mt-0.5 text-[10px] text-white/85 truncate',
                        isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-100',
                        'transition-opacity duration-200',
                      ].join(' ')}
                    >
                      {desc}
                    </div>
                  </div>
                </div>

                <div
                  className="relative shrink-0 rounded-full border border-white/60 bg-white p-2 shadow-sm transition-shadow group-hover:shadow-md"
                  style={{ color: accentHex }}
                >
                  <ArrowRight className="h-4 w-4" />
                </div>
              </Link>
            );
          })}
        </div>
      </nav>
    </aside>
  );
}
