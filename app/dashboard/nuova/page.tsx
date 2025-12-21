'use client';

import Link from 'next/link';
import Image from 'next/image';
import { FileText, ArrowRight } from 'lucide-react';

// Icona bicchiere di vino (SVG inline, stile lucide-like)
function WineGlassIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <path d="M7 3h10v2a5 5 0 0 1-5 5h0a5 5 0 0 1-5-5V3z" />
      <path d="M12 10v7" />
      <path d="M8 21h8" />
      <path d="M8 6.5c1.2.8 2.8 1.3 4 1.3s2.8-.5 4-1.3" />
    </svg>
  );
}

const SPST_BLUE = '#1c3e5e';
const BADGE_DOT_GREEN = '#22c55e'; // tailwind green-500 (ma usato come hex per coerenza)

type CardConfig = {
  href: string;
  title: string;
  description: string;
  badge: string;
  icon: React.ReactNode;
  bgImage: string; // path in /public
};

const CARDS: CardConfig[] = [
  {
    href: '/dashboard/nuova/vino',
    title: 'Spedizione vino',
    badge: 'Accise + documenti',
    description:
      'Dati completi e fatture. Tutto ciò che serve per spedire prodotti soggetti ad accisa.',
    icon: <WineGlassIcon width={22} height={22} />,
    // ✅ Metti la tua immagine Canva qui (public/dashboard/nuova/bg-wine.jpg)
    bgImage: '/dashboard/nuova/bg-wine.jpg',
  },
  {
    href: '/dashboard/nuova/altro',
    title: 'Altre spedizioni',
    badge: 'Merce generica',
    description: 'Documenti non soggetti ad accisa, materiali, brochure, ecc.',
    icon: <FileText size={22} />,
    // ✅ Metti la tua immagine Canva qui (public/dashboard/nuova/bg-other.jpg)
    bgImage: '/dashboard/nuova/bg-other.jpg',
  },
];

export default function NuovaSpedizioneSelettore() {
  return (
    <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
      <div className="py-8 sm:py-10">
        <div className="mx-auto max-w-3xl text-center">
          <h1 className="text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">
            Nuova spedizione
          </h1>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Scegli il tipo di spedizione: vino (accise e documentazione completa) oppure merce
            generica.
          </p>
        </div>

        <div className="mt-10 grid gap-6 lg:grid-cols-2">
          {CARDS.map((c) => (
            <Link
              key={c.href}
              href={c.href}
              aria-label={`Vai a ${c.title}`}
              className="group relative overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-[0_18px_45px_rgba(15,23,42,0.08)] transition-all hover:-translate-y-1 hover:shadow-[0_26px_70px_rgba(15,23,42,0.14)] focus:outline-none focus:ring-2 focus:ring-[#1c3e5e]/30"
            >
              {/* Background image */}
              <div className="absolute inset-0">
                <Image
                  src={c.bgImage}
                  alt=""
                  fill
                  sizes="(max-width: 1024px) 100vw, 50vw"
                  className="object-cover opacity-[0.35] transition-transform duration-500 group-hover:scale-[1.03]"
                  // ✅ pensato per immagini verticali 3:4: tieni il “soggetto” in alto/centro
                  style={{ objectPosition: 'center 25%' }}
                />

                {/* overlay: leggibilità + vibe premium */}
                <div className="absolute inset-0 bg-gradient-to-br from-white/85 via-white/70 to-white/30" />
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(28,62,94,0.10),transparent_55%)]" />
              </div>

              {/* Content (aumentato in altezza / respiro Y) */}
              <div className="relative p-8 sm:p-10 min-h-[260px] sm:min-h-[290px]">
                {/* badge */}
                <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/70 px-3 py-1 text-[12px] font-medium text-slate-700 backdrop-blur">
                  <span
                    className="inline-block h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: BADGE_DOT_GREEN }}
                  />
                  {c.badge}
                </div>

                <div className="mt-7 flex items-start gap-4">
                  {/* icon bubble */}
                  <div
                    className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border bg-white/70 shadow-sm backdrop-blur"
                    style={{
                      color: SPST_BLUE,
                      borderColor: `${SPST_BLUE}33`,
                    }}
                  >
                    {c.icon}
                  </div>

                  <div className="min-w-0">
                    <h3 className="text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">
                      <span className="text-spst-orange">{c.title}</span>
                    </h3>
                    <p className="mt-2 max-w-[46ch] text-sm leading-6 text-slate-600 sm:text-[15px]">
                      {c.description}
                    </p>
                  </div>
                </div>

                {/* bottom row */}
                <div className="mt-9 flex items-center justify-between">
                  <div className="text-[12px] text-slate-500">Apri il modulo e compila i dati</div>

                  <div className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-4 py-2 text-sm font-medium text-white shadow-sm transition-all group-hover:translate-x-0.5">
                    Continua
                    <ArrowRight size={16} />
                  </div>
                </div>
              </div>

              {/* subtle border glow on hover */}
              <div className="pointer-events-none absolute inset-0 rounded-[28px] ring-0 ring-[#1c3e5e]/0 transition-all group-hover:ring-1 group-hover:ring-[#1c3e5e]/15" />
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
