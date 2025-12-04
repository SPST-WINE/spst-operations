// components/usa/USAChargesCalculator.tsx
"use client";

import { useMemo, useState } from "react";
import QRCode from "react-qr-code";
import { computeTotals, getShippingForBottleCount } from "@/lib/usa-shipping/calc";
import { SHIPPING_TABLE } from "@/lib/usa-shipping/constants";

type Props = {
  initialWineryName?: string;
  initialWineryEmail?: string;
};

const BOTTLE_OPTIONS = [6, 12, 18, 24, 30, 36, 42, 48, 54, 60];

export default function USAChargesCalculator({
  initialWineryName = "",
  initialWineryEmail = "",
}: Props) {
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
        const shipping = bottleCount ? getShippingForBottleCount(bottleCount) : 0;
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
      setError("Inserisci il nome della cantina.");
      return;
    }
    if (!wineryEmail.trim()) {
      setError("Inserisci l'email della cantina.");
      return;
    }
    if (!customerEmail.trim()) {
      setError("Inserisci l'email del cliente.");
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
        throw new Error(text || "Errore nella creazione del link di pagamento.");
      }

      const data = (await res.json()) as { url: string };
      setCheckoutUrl(data.url);
    } catch (err: any) {
      console.error(err);
      setError(err?.message ?? "Errore imprevisto.");
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
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-white/80">
            Nome cantina
          </label>
          <input
            className="w-full rounded-lg bg-black/30 border border-white/15 px-3 py-2 text-sm outline-none focus:border-white/40"
            value={wineryName}
            onChange={(e) => setWineryName(e.target.value)}
            placeholder="Es. Tenuta X"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-white/80">
            Email cantina (riceverà la conferma pagamento)
          </label>
          <input
            type="email"
            className="w-full rounded-lg bg-black/30 border border-white/15 px-3 py-2 text-sm outline-none focus:border-white/40"
            value={wineryEmail}
            onChange={(e) => setWineryEmail(e.target.value)}
            placeholder="es. export@tenutax.it"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-white/80">
            Email cliente (USA)
          </label>
          <input
            type="email"
            className="w-full rounded-lg bg-black/30 border border-white/15 px-3 py-2 text-sm outline-none focus:border-white/40"
            value={customerEmail}
            onChange={(e) => setCustomerEmail(e.target.value)}
            placeholder="es. customer@email.com"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-white/80">
            Numero bottiglie (equivalenti)
          </label>
          <select
            className="w-full rounded-lg bg-black/30 border border-white/15 px-3 py-2 text-sm outline-none focus:border-white/40"
            value={bottleCount}
            onChange={(e) => setBottleCount(Number(e.target.value))}
          >
            {BOTTLE_OPTIONS.map((n) => (
              <option key={n} value={n}>
                {n} bottiglie
              </option>
            ))}
          </select>
          <p className="text-[11px] text-white/60 leading-snug">
            Le bottiglie magnum da 1,5L vanno conteggiate come 3 bottiglie
            standard da 0,75L. Se ad esempio hai 4 magnum, seleziona 12
            bottiglie.
          </p>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-white/80">
            Valore merce dichiarato (€)
          </label>
          <input
            inputMode="decimal"
            className="w-full rounded-lg bg-black/30 border border-white/15 px-3 py-2 text-sm outline-none focus:border-white/40"
            value={goodsValue}
            onChange={(e) => setGoodsValue(e.target.value)}
            placeholder="Es. 250"
          />
        </div>

        <div className="rounded-xl bg-black/40 border border-white/10 p-4 text-xs space-y-2">
          <div className="flex justify-between">
            <span className="text-white/70">Valore merce</span>
            <span>€ {numericGoodsValue.toFixed(2)}</span>
          </div>

          <div className="flex justify-between">
            <span className="text-white/70">Trasporto</span>
            <span>
              €{" "}
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
            <span className="text-white/70">Dazi (15% valore merce)</span>
            <span>
              € {breakdown ? breakdown.duties.toFixed(2) : "0.00"}
            </span>
          </div>

          <div className="flex justify-between">
            <span className="text-white/70">Fee Stripe (incluse nel totale)</span>
            <span>
              € {breakdown ? breakdown.stripeFee.toFixed(2) : "0.00"}
            </span>
          </div>

          <div className="border-t border-white/10 my-2" />

          <div className="flex justify-between text-[13px] font-semibold">
            <span>Totale che il cliente pagherà</span>
            <span>
              € {breakdown ? breakdown.total.toFixed(2) : "0.00"}
            </span>
          </div>

          <p className="text-[11px] text-white/60 mt-1">
            Il totale include trasporto, dazi (15%) e commissioni Stripe.
          </p>
        </div>

        {error && (
          <div className="rounded-lg bg-red-500/10 border border-red-500/40 px-3 py-2 text-xs text-red-100">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={isGenerating}
          className="w-full rounded-xl bg-white text-black text-sm font-semibold py-2.5 shadow-md shadow-black/40 disabled:opacity-60 disabled:cursor-not-allowed hover:bg-neutral-100 transition"
        >
          {isGenerating ? "Genero il link..." : "Genera link di pagamento"}
        </button>
      </form>

      {checkoutUrl && (
        <div className="space-y-4">
          <div className="rounded-2xl bg-white/5 border border-white/10 p-4">
            <label className="text-[11px] uppercase tracking-wide text-white/60">
              Link di pagamento
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
                {copied ? "Copiato" : "Copia"}
              </button>
            </div>
          </div>

          <div className="rounded-2xl bg-black/40 border border-white/10 p-4 flex flex-col items-center gap-3">
            <p className="text-xs text-white/75 text-center">
              QR code per il cliente
            </p>
            <div className="bg-white p-3 rounded-xl">
              <QRCode value={checkoutUrl} size={180} />
            </div>
            <p className="text-[11px] text-white/60 text-center max-w-xs">
              Puoi mostrare questo QR al cliente o inviargli il link/QR via
              WhatsApp o email.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
