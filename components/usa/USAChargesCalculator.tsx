// components/usa/USAChargesCalculator.tsx
"use client";

import { useMemo, useState } from "react";
import QRCode from "react-qr-code";
import {
  computeTotals,
  getShippingForBottleCount,
} from "@/lib/usa-shipping/calc";

type Props = {
  initialWineryName?: string;
  initialWineryEmail?: string;
  lang: "it" | "en";
};

const BOTTLE_OPTIONS = [6, 12, 18, 24, 30, 36, 42, 48, 54, 60];

export default function USAChargesCalculator({
  initialWineryName = "",
  initialWineryEmail = "",
  lang,
}: Props) {
  const dict = {
    it: {
      wineryName: "Nome cantina",
      wineryEmail: "Email cantina (riceverà la conferma pagamento)",
      customerEmail: "Email cliente (USA)",
      bottleCount: "Numero bottiglie (equivalenti)",
      magnumNote:
        "Le bottiglie magnum da 1,5L vanno conteggiate come 3 bottiglie standard da 0,75L. Se ad esempio hai 4 magnum, seleziona 12 bottiglie.",
      goodsValue: "Valore merce dichiarato (€)",
      summaryGoods: "Valore merce",
      summaryShipping: "Trasporto",
      summaryDuties: "Dazi (15% valore merce)",
      summaryStripe: "Fee Stripe (incluse nel totale)",
      summaryTotal: "Totale che il cliente pagherà",
      summaryFooter:
        "Il totale include trasporto, dazi (15%) e commissioni Stripe.",
      genBtn: "Genera link di pagamento",
      genBtnLoading: "Genero il link...",
      fieldErrorWinery: "Inserisci il nome della cantina.",
      fieldErrorWineryEmail: "Inserisci l'email della cantina.",
      fieldErrorCustomer: "Inserisci l'email del cliente.",
      linkLabel: "Link di pagamento",
      copy: "Copia",
      copied: "Copiato",
      qrTitle: "QR code per il cliente",
      qrDesc:
        "Puoi mostrare questo QR al cliente o inviargli il link/QR via WhatsApp o email.",
    },
    en: {
      wineryName: "Winery name",
      wineryEmail: "Winery email (will receive payment confirmation)",
      customerEmail: "Customer email (USA)",
      bottleCount: "Bottle count (equivalent)",
      magnumNote:
        "Magnum bottles (1.5L) must be counted as 3 standard 0.75L bottles. Example: 4 magnums = select 12 bottles.",
      goodsValue: "Declared goods value (€)",
      summaryGoods: "Goods value",
      summaryShipping: "Shipping",
      summaryDuties: "Duties (15% goods value)",
      summaryStripe: "Stripe fees (included in total)",
      summaryTotal: "Total the customer will pay",
      summaryFooter:
        "Total includes shipping, duties (15%) and Stripe fees.",
      genBtn: "Generate payment link",
      genBtnLoading: "Generating...",
      fieldErrorWinery: "Enter the winery name.",
      fieldErrorWineryEmail: "Enter the winery email.",
      fieldErrorCustomer: "Enter the customer email.",
      linkLabel: "Payment link",
      copy: "Copy",
      copied: "Copied",
      qrTitle: "Customer QR code",
      qrDesc:
        "You can show this QR to the customer or send it via WhatsApp or email.",
    },
  }[lang];

  const [wineryName, setWineryName] = useState(initialWineryName);
  const [wineryEmail, setWineryEmail] = useState(initialWineryEmail);
  const [customerEmail, setCustomerEmail] = useState("");
  const [bottleCount, setBottleCount] = useState<number>(12);
  const [goodsValue, setGoodsValue] = useState<string>("250");

  const [checkoutUrl, setCheckoutUrl] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const numericGoodsValue = useMemo(() => {
    const n = Number(goodsValue.replace(",", "."));
    return Number.isFinite(n) ? Math.max(0, n) : 0;
  }, [goodsValue]);

  const breakdown = useMemo(() => {
    try {
      if (!bottleCount || !numericGoodsValue) {
        const shipping = bottleCount
          ? getShippingForBottleCount(bottleCount)
          : 0;
        return {
          shipping,
          duties: 0,
          baseCharge: shipping,
          stripeFee: 0,
          total: shipping,
        };
      }
      return computeTotals(bottleCount, numericGoodsValue);
    } catch {
      return null;
    }
  }, [bottleCount, numericGoodsValue]);

  async function handleGenerateLink(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setCopied(false);
    setCheckoutUrl(null);

    if (!wineryName.trim()) {
      setError(dict.fieldErrorWinery);
      return;
    }
    if (!wineryEmail.trim()) {
      setError(dict.fieldErrorWineryEmail);
      return;
    }
    if (!customerEmail.trim()) {
      setError(dict.fieldErrorCustomer);
      return;
    }

    try {
      setIsGenerating(true);

      const res = await fetch("/api/usa-shipping-pay/create-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          wineryName: wineryName.trim(),
          wineryEmail: wineryEmail.trim(),
          customerEmail: customerEmail.trim(),
          bottleCount,
          goodsValue: numericGoodsValue,
        }),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "Error creating payment link.");
      }

      const data = (await res.json()) as { url: string };
      setCheckoutUrl(data.url);
    } catch (err: any) {
      console.error(err);
      setError(err?.message ?? "Unexpected error.");
    } finally {
      setIsGenerating(false);
    }
  }

  async function handleCopy() {
    if (!checkoutUrl) return;
    try {
      await navigator.clipboard.writeText(checkoutUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="space-y-6">
      <form
        onSubmit={handleGenerateLink}
        className="rounded-2xl bg-white/5 border border-white/10 p-5 shadow-xl backdrop-blur space-y-4"
      >
        {/* WINERY NAME */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-white/80">
            {dict.wineryName}
          </label>
          <input
            className="w-full rounded-lg bg-black/30 border border-white/15 px-3 py-2 text-sm outline-none focus:border-white/40"
            value={wineryName}
            onChange={(e) => setWineryName(e.target.value)}
            placeholder="Tenuta X"
          />
        </div>

        {/* WINERY EMAIL */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-white/80">
            {dict.wineryEmail}
          </label>
          <input
            type="email"
            className="w-full rounded-lg bg-black/30 border border-white/15 px-3 py-2 text-sm outline-none focus:border-white/40"
            value={wineryEmail}
            onChange={(e) => setWineryEmail(e.target.value)}
            placeholder="export@tenutax.it"
          />
        </div>

        {/* CUSTOMER EMAIL */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-white/80">
            {dict.customerEmail}
          </label>
          <input
            type="email"
            className="w-full rounded-lg bg-black/30 border border-white/15 px-3 py-2 text-sm outline-none focus:border-white/40"
            value={customerEmail}
            onChange={(e) => setCustomerEmail(e.target.value)}
            placeholder="customer@email.com"
          />
        </div>

        {/* BOTTLE COUNT */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-white/80">
            {dict.bottleCount}
          </label>
          <select
            className="w-full rounded-lg bg-black/30 border border-white/15 px-3 py-2 text-sm outline-none focus:border-white/40"
            value={bottleCount}
            onChange={(e) => setBottleCount(Number(e.target.value))}
          >
            {BOTTLE_OPTIONS.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>

          <p className="text-[11px] text-white/60 leading-snug">
            {dict.magnumNote}
          </p>
        </div>

        {/* GOODS VALUE */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-white/80">
            {dict.goodsValue}
          </label>
          <input
            inputMode="decimal"
            className="w-full rounded-lg bg-black/30 border border-white/15 px-3 py-2 text-sm outline-none focus:border-white/40"
            value={goodsValue}
            onChange={(e) => setGoodsValue(e.target.value)}
            placeholder="250"
          />
        </div>

        {/* SUMMARY BOX */}
        <div className="rounded-xl bg-black/40 border border-white/10 p-4 text-xs space-y-2">
          <div className="flex justify-between">
            <span className="text-white/70">{dict.summaryGoods}</span>
            <span>€ {numericGoodsValue.toFixed(2)}</span>
          </div>

          <div className="flex justify-between">
            <span className="text-white/70">{dict.summaryShipping}</span>
            <span>
              €
              {(() => {
                try {
                  return getShippingForBottleCount(bottleCount).toFixed(2);
                } catch {
                  return "0.00";
                }
              })()}
            </span>
          </div>

          <div className="flex justify-between">
            <span className="text-white/70">{dict.summaryDuties}</span>
            <span>€ {breakdown ? breakdown.duties.toFixed(2) : "0.00"}</span>
          </div>

          <div className="flex justify-between">
            <span className="text-white/70">{dict.summaryStripe}</span>
            <span>€ {breakdown ? breakdown.stripeFee.toFixed(2) : "0.00"}</span>
          </div>

          <div className="border-t border-white/10 my-2" />

          <div className="flex justify-between text-[13px] font-semibold">
            <span>{dict.summaryTotal}</span>
            <span>€ {breakdown ? breakdown.total.toFixed(2) : "0.00"}</span>
          </div>

          <p className="text-[11px] text-white/60 mt-1">{dict.summaryFooter}</p>
        </div>

        {/* ERROR */}
        {error && (
          <div className="rounded-lg bg-red-500/10 border border-red-500/40 px-3 py-2 text-xs text-red-100">
            {error}
          </div>
        )}

        {/* BUTTON */}
        <button
          type="submit"
          disabled={isGenerating}
          className="w-full rounded-xl bg-white text-black text-sm font-semibold py-2.5 shadow-md shadow-black/40 disabled:opacity-60 disabled:cursor-not-allowed hover:bg-neutral-100 transition"
        >
          {isGenerating ? dict.genBtnLoading : dict.genBtn}
        </button>
      </form>

      {/* OUTPUT */}
      {checkoutUrl && (
        <div className="space-y-4">
          <div className="rounded-2xl bg-white/5 border border-white/10 p-4">
            <label className="text-[11px] uppercase tracking-wide text-white/60">
              {dict.linkLabel}
            </label>

            <div className="mt-1 flex items-center gap-2">
              <input
                readOnly
                className="flex-1 rounded-lg bg-black/40 border border-white/15 px-3 py-2 text-xs outline-none"
                value={checkoutUrl}
              />
              <button
                type="button"
                onClick={handleCopy}
                className="text-xs whitespace-nowrap rounded-lg border border-white/30 px-3 py-2 hover:bg-white/10 transition"
              >
                {copied ? dict.copied : dict.copy}
              </button>
            </div>
          </div>

          <div className="rounded-2xl bg-black/40 border border-white/10 p-4 flex flex-col items-center gap-3">
            <p className="text-xs text-white/75 text-center">{dict.qrTitle}</p>

            <div className="bg-white p-3 rounded-xl">
              <QRCode value={checkoutUrl} size={180} />
            </div>

            <p className="text-[11px] text-white/60 text-center max-w-xs">
              {dict.qrDesc}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
