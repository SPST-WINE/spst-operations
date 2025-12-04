// app/usa-shipping-pay/page.tsx
"use client";

import { useState, useEffect } from "react";
import Head from "next/head";
import Image from "next/image";
import USAChargesCalculator from "@/components/usa/USAChargesCalculator";

const PAGE_GRADIENT =
  "radial-gradient(120% 120% at 50% -10%, #1c3e5e 0%, #0a1722 60%, #000 140%)";

type SearchParams = {
  wname?: string;
  wemail?: string;
};

const dict = {
  it: {
    pageTitle: "Spedizioni USA – Trasporto + Dazi",
    subtitle:
      "Genera un link di pagamento per il tuo cliente negli USA. Il totale include trasporto, dazi (15%) e commissioni Stripe.",
  },
  en: {
    pageTitle: "US Shipping – Transport + Duties",
    subtitle:
      "Generate a payment link for your US customer. Total includes shipping, duties (15%) and Stripe fees.",
  },
};

function SimpleHeader({
  lang,
  setLang,
}: {
  lang: "it" | "en";
  setLang: (v: "it" | "en") => void;
}) {
  return (
    <header className="w-full border-b border-white/10 bg-black/30 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-3">

        {/* LEFT: LOGO + TITLE */}
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
              SPST – US Shipping & Duties
            </span>
            <span className="text-[11px] text-white/60">
              Fast & compliant US deliveries
            </span>
          </div>
        </div>

        {/* RIGHT: LANGUAGE SWITCH */}
        <div className="flex items-center gap-2 bg-black/40 border border-white/20 rounded-full px-1.5 py-1">
          <button
            type="button"
            onClick={() => setLang("it")}
            className={`px-3 py-0.5 text-xs rounded-full transition font-semibold ${
              lang === "it"
                ? "bg-white text-black"
                : "text-white/60 hover:text-white"
            }`}
          >
            IT
          </button>

          <button
            type="button"
            onClick={() => setLang("en")}
            className={`px-3 py-0.5 text-xs rounded-full transition font-semibold ${
              lang === "en"
                ? "bg-white text-black"
                : "text-white/60 hover:text-white"
            }`}
          >
            EN
          </button>
        </div>
      </div>
    </header>
  );
}

function SimpleFooter() {
  return (
    <footer className="mt-8 border-t border-white/10 bg-black/40">
      <div className="mx-auto flex max-w-5xl flex-col items-center gap-1 px-5 py-4 text-[11px] text-white/50">
        <span>SPST · Specialized Wine Shipping & Trade</span>
        <span>Powered by Stripe · Payments for US shipping & duties</span>
      </div>
    </footer>
  );
}

export default function USAShippingPayPage({
  searchParams,
}: {
  searchParams?: SearchParams;
}) {
  const [lang, setLang] = useState<"it" | "en">("it");

  // Dynamic document.title
  useEffect(() => {
    document.title =
      lang === "it"
        ? "SPST – Spedizioni USA"
        : "SPST US Shipping & Duties";
  }, [lang]);

  const initialWineryName = searchParams?.wname ?? "";
  const initialWineryEmail = searchParams?.wemail ?? "";

  const t = dict[lang];

  return (
    <>
      {/* Static SEO title (fallback) */}
      <Head>
        <title>SPST US Shipping & Duties</title>
        <meta
          name="description"
          content="Generate payment links for US shipping and duties."
        />
      </Head>

      <main
        className="min-h-screen text-white flex flex-col"
        style={{ background: PAGE_GRADIENT }}
      >
        <SimpleHeader lang={lang} setLang={setLang} />

        <div className="flex-1">
          <div className="mx-auto w-full max-w-md px-5 py-8">
            <h1 className="text-2xl font-semibold tracking-tight mb-2">
              {t.pageTitle}
            </h1>

            <p className="text-sm text-white/70 mb-5">{t.subtitle}</p>

            <USAChargesCalculator
              lang={lang}
              initialWineryName={initialWineryName}
              initialWineryEmail={initialWineryEmail}
            />
          </div>
        </div>

        <SimpleFooter />
      </main>
    </>
  );
}
