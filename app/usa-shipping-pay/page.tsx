// app/usa-shipping-pay/page.tsx
"use client";

export const dynamic = "force-dynamic";

import { useState, useEffect } from "react";
import Image from "next/image";
import Head from "next/head";
import USAChargesCalculator from "@/components/usa/USAChargesCalculator";

const PAGE_GRADIENT =
  "radial-gradient(120% 120% at 50% -10%, #1c3e5e 0%, #0a1722 60%, #000 140%)";

type SearchParams = {
  wname?: string;
  wemail?: string;
  lang?: string;
};

export default function USAShippingPayPage(props: { searchParams?: SearchParams }) {
  const { searchParams } = props;

  // Lingua: prende da URL o default IT
  const [lang, setLang] = useState(
    (searchParams?.lang ?? "it").toLowerCase()
  );

  // Testi IT/EN
  const dict = {
    it: {
      headerTitle: "SPST – US Shipping",
      headerSubtitle: "Pagamento trasporto + dazi (USA)",
      pageTitle: "SPST US Shipping",
      pageSubtitle:
        "Genera un link di pagamento per il tuo cliente negli USA. Il totale include trasporto, dazi (15%) e commissioni Stripe.",
      footerLine1: "SPST · Specialized Wine Shipping & Trade",
      footerLine2: "Powered by Stripe · US Shipping & Duties",
      browserTitle: "SPST US Shipping",
      langLabel: "Lingua",
    },
    en: {
      headerTitle: "SPST – US Shipping",
      headerSubtitle: "Payment link for US shipping + duties",
      pageTitle: "SPST US Shipping",
      pageSubtitle:
        "Generate a secure payment link for your US customer. Total includes shipping, duties (15%) and Stripe fees.",
      footerLine1: "SPST · Specialized Wine Shipping & Trade",
      footerLine2: "Powered by Stripe · US Shipping & Duties",
      browserTitle: "SPST US Shipping",
      langLabel: "Language",
    },
  };

  const t = dict[lang];

  const initialWineryName = searchParams?.wname ?? "";
  const initialWineryEmail = searchParams?.wemail ?? "";

  return (
    <main
      className="min-h-screen text-white flex flex-col"
      style={{ background: PAGE_GRADIENT }}
    >
      <Head>
        <title>{t.browserTitle}</title>
      </Head>

      {/* HEADER */}
      <header className="w-full border-b border-white/10 bg-black/30 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-3">
          <div className="flex items-center gap-3">
            <div className="relative h-8 w-8">
              <Image
                src="/spst-logo.png"
                alt="SPST logo"
                fill
                className="object-contain"
                priority
              />
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-semibold tracking-tight">
                {t.headerTitle}
              </span>
              <span className="text-[11px] text-white/60">
                {t.headerSubtitle}
              </span>
            </div>
          </div>

          {/* LANGUAGE SELECT */}
          <select
            value={lang}
            onChange={(e) => setLang(e.target.value)}
            className="bg-black/20 border border-white/20 rounded px-2 py-1 text-xs"
          >
            <option value="it">🇮🇹 IT</option>
            <option value="en">🇺🇸 EN</option>
          </select>
        </div>
      </header>

      {/* CONTENT */}
      <div className="flex-1">
        <div className="mx-auto w-full max-w-md px-5 py-8">
          <h1 className="text-2xl font-semibold tracking-tight mb-2">
            {t.pageTitle}
          </h1>

          <p className="text-sm text-white/70 mb-5">{t.pageSubtitle}</p>

          <USAChargesCalculator
            lang={lang}
            initialWineryName={initialWineryName}
            initialWineryEmail={initialWineryEmail}
          />
        </div>
      </div>

      {/* FOOTER */}
      <footer className="mt-8 border-t border-white/10 bg-black/40">
        <div className="mx-auto flex max-w-5xl flex-col items-center gap-1 px-5 py-4 text-[11px] text-white/50">
          <span>{t.footerLine1}</span>
          <span>{t.footerLine2}</span>
        </div>
      </footer>
    </main>
  );
}
