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
const BADGE_DOT_GREEN = '#22c55e'; // green-500

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
    // ✅ stessi path
    bgImage: '/dashboard/nuova/bg-wine.jpg',
  },
  {
    href: '/dashboard/nuova/altro',
    title: 'Altre spedizioni',
    badge: 'Merce generica',
    description: 'Documenti non soggetti ad accisa, materiali, brochure, ecc.',
    icon: <FileText size={22} />,
    // ✅ stessi path
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
            Scegli il tipo di spedizione
          </p>
        </div>

        {/* Wrapper più “stretto” + divisore centrale */}
        <div className="mx-auto mt-10 max-w-5xl">
          <div className="relative grid gap-6 lg:grid-cols-2">
            {/* divisore verticale (desktop) */}
            <div className="pointer-events-none absolute left-1/2 top-0 hidden h-full w-px -translate-x-1/2 bg-slate-200/70 lg:block" />

            {CARDS.map((c) => (
              <Link
                key={c.href}
                href={c.href}
                aria-label={`Vai a ${c.title}`}
                className="group relative overflow-hidden rounded-[28px] border border-slate-800/60 bg-[#0b0f17] shadow-[0_18px_55px_rgba(0,0,0,0.35)] transition-all hover:-translate-y-1 hover:shadow-[0_26px_80px_rgba(0,0,0,0.45)] focus:outline-none focus:ring-2 focus:ring-white/20"
              >
                {/* Background image */}
                <div className="absolute inset-0">
                  <Image
                    src={c.bgImage}
                    alt=""
                    fill
                    sizes="(max-width: 1024px) 100vw, 50vw"
                    className="object-cover opacity-[0.35] transition-transform duration-500 group-hover:scale-[1.03]"
                    style={{ objectPosition: 'center 25%' }}
                  />

                  {/* overlay scuro con accento “nero” */}
                  <div className="absolute inset-0 bg-gradient-to-br from-black/80 via-black/65 to-black/55" />
                  {/* accento “blu scuro” in alto per match brand */}
                  <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(28,62,94,0.35),transparent_55%)]" />
                  {/* vignetta leggera */}
                  <div className="absolute inset-0 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.06),inset_0_-120px_160px_rgba(0,0,0,0.55)]" />
                </div>

                {/* Content: più stretto + molto più alto (quasi doppio) */}
                <div className="relative px-7 py-10 sm:px-10 sm:py-12 min-h-[440px] sm:min-h-[520px]">
                  {/* badge */}
                  <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[12px] font-medium text-white/85 backdrop-blur">
                    <span
                      className="inline-block h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: BADGE_DOT_GREEN }}
                    />
                    {c.badge}
                  </div>

                  <div className="mt-7 flex items-start gap-4">
                    {/* icon bubble */}
                    <div
                      className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border bg-white/5 shadow-sm backdrop-blur"
                      style={{
                        color: 'white',
                        borderColor: 'rgba(255,255,255,0.10)',
                      }}
                    >
                      {c.icon}
                    </div>

                    <div className="min-w-0">
                      <h3 className="text-xl font-semibold tracking-tight text-white sm:text-2xl">
                        <span className="text-spst-orange">{c.title}</span>
                      </h3>
                      <p className="mt-2 max-w-[44ch] text-sm leading-6 text-white/75 sm:text-[15px]">
                        {c.description}
                      </p>
                    </div>
                  </div>

                  {/* divisore interno (come “due card” in una) */}
                  <div className="my-10 h-px w-full bg-white/10" />

                  {/* seconda “metà” */}
                  <div className="flex flex-col gap-4">
                    <div className="text-[12px] text-white/60">
                      Apri il modulo e compila i dati
                    </div>

                    <div className="inline-flex w-fit items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-semibold text-slate-900 shadow-sm transition-all group-hover:translate-x-0.5">
                      Continua
                      <ArrowRight size={16} />
                    </div>

                    <div className="pt-2 text-[12px] text-white/55">
                      Hai dubbi? Usa il pulsante “Supporto WhatsApp” in alto a destra.
                    </div>
                  </div>
                </div>

                {/* glow on hover */}
                <div className="pointer-events-none absolute inset-0 rounded-[28px] ring-0 ring-white/0 transition-all group-hover:ring-1 group-hover:ring-white/10" />
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
