"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import {
  CheckCircle2,
  Clock,
  AlertCircle,
  Loader2,
  Package,
  MapPin,
  ShieldCheck,
  Ruler,
  Weight,
} from "lucide-react";

type Props = { token: string };

type Party = {
  ragioneSociale?: string;
  paese?: string;
  citta?: string;
  cap?: string;
  indirizzo?: string;
  telefono?: string;
  taxId?: string;
};

type Collo = {
  quantita?: number;
  lunghezza_cm?: number | null;
  larghezza_cm?: number | null;
  altezza_cm?: number | null;
  peso_kg?: number | null;
};

type PublicQuote = {
  id: string;
  human_id: string | null;
  status: string | null;
  created_at: string | null;
  data_ritiro: string | null;
  tipo_spedizione: string | null;
  incoterm: string | null;
  valuta: string | null;
  email_cliente: string | null;
  mittente: Party | null;
  destinatario: Party | null;
  accepted_option_id: string | null;

  colli: Collo[] | null;
  contenuto_colli: string | null;
  declared_value: number | null; // ✅ valore assicurato
};

type PublicQuoteOption = {
  id: string;
  quote_id: string;
  label: string | null;
  carrier: string | null;
  service_name: string | null;
  transit_time: string | null;
  freight_price: number | null;
  customs_price: number | null;
  total_price: number | null;
  currency: string | null;
  public_notes: string | null;
  status: string | null;
  show_vat: boolean | null;
  vat_rate: number | null;
};

function formatDate(dateStr?: string | null) {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("it-IT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function formatCurrency(amount?: number | null, currency?: string | null) {
  if (amount == null) return "—";
  try {
    return new Intl.NumberFormat("it-IT", {
      style: "currency",
      currency: currency || "EUR",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${currency || "EUR"}`;
  }
}

function fieldLine(label: string, value?: string | null) {
  if (!value) return null;
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="text-[11px] text-slate-500">{label}</div>
      <div className="text-[12px] font-medium text-slate-900 text-right">
        {value}
      </div>
    </div>
  );
}

function partySummary(p?: Party | null) {
  if (!p) return { title: "—", lines: [] as string[] };
  const title = p.ragioneSociale?.trim() || "—";
  const lines: string[] = [];

  const addr = [p.indirizzo, p.cap, p.citta].filter(Boolean).join(", ");
  const place = [p.paese].filter(Boolean).join("");

  if (addr) lines.push(addr);
  if (place) lines.push(place);
  if (p.telefono) lines.push(`Tel: ${p.telefono}`);
  if (p.taxId) lines.push(`Tax/VAT: ${p.taxId}`);

  return { title, lines };
}

function n(x: any): number | null {
  const v = Number(x);
  return Number.isFinite(v) ? v : null;
}

export default function QuotePublicClient({ token }: Props) {
  const [quote, setQuote] = useState<PublicQuote | null>(null);
  const [options, setOptions] = useState<PublicQuoteOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [thankYou, setThankYou] = useState(false);

  useEffect(() => {
    let active = true;

    async function load() {
      setLoading(true);
      setError(null);
      setThankYou(false);

      try {
        const res = await fetch(`/api/quote-public/${token}`, {
          cache: "no-store",
        });
        const json = await res.json().catch(() => ({} as any));
        if (!active) return;

        if (!res.ok || !json?.ok) {
          setError(
            json?.error === "QUOTE_NOT_FOUND"
              ? "Questa quotazione non è più disponibile."
              : "Si è verificato un errore nel caricamento della quotazione."
          );
          setQuote(null);
          setOptions([]);
          return;
        }

        setQuote(json.quote as PublicQuote);
        setOptions(json.options as PublicQuoteOption[]);
      } catch (e) {
        console.error("[QuotePublicClient] load error:", e);
        if (active) {
          setError("Si è verificato un errore nel caricamento della quotazione.");
          setQuote(null);
          setOptions([]);
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    load();
    return () => {
      active = false;
    };
  }, [token]);

  const alreadyAccepted = useMemo(() => {
    if (!quote) return false;
    return (
      quote.status === "accettata" ||
      !!quote.accepted_option_id ||
      options.some((o) => o.status === "accettata")
    );
  }, [quote, options]);

  const ship = useMemo(() => {
    const mitt = partySummary(quote?.mittente);
    const dest = partySummary(quote?.destinatario);

    const colli = Array.isArray(quote?.colli) ? quote!.colli : [];

    const totalPieces = colli.reduce((sum, c) => sum + (n(c.quantita) ?? 0), 0);

    const totalWeight = colli.reduce((sum, c) => {
      const q = n(c.quantita) ?? 1;
      const w = n(c.peso_kg) ?? 0;
      return sum + w * q;
    }, 0);

    const VOL_DIV = 4000;

    const totalVolumeCm3 = colli.reduce((sum, c) => {
      const q = n(c.quantita) ?? 1;
      const l = n(c.lunghezza_cm);
      const w = n(c.larghezza_cm);
      const h = n(c.altezza_cm);
      if (!l || !w || !h) return sum;
      return sum + l * w * h * q;
    }, 0);

    const totalVolumeM3 = totalVolumeCm3 / 1_000_000;
    const volumetricWeightKg = totalVolumeCm3 / VOL_DIV;

    const billedWeightKg = Math.max(totalWeight || 0, volumetricWeightKg || 0);

    return {
      mitt,
      dest,
      colli,
      totalPieces,
      totalWeight,
      totalVolumeM3,
      volumetricWeightKg,
      billedWeightKg,
      volDivisor: VOL_DIV,
    };
  }, [quote]);

  const insuranceActive = useMemo(() => {
    const v = quote?.declared_value;
    return v != null && Number.isFinite(v) && v > 0;
  }, [quote?.declared_value]);

  async function handleAccept(optionId: string) {
    if (!quote) return;
    if (alreadyAccepted) return;

    setAccepting(optionId);
    setError(null);

    try {
      const res = await fetch(`/api/quote-public/${token}/accept`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ optionId }),
      });

      const json = await res.json().catch(() => ({} as any));

      if (!res.ok || !json?.ok) {
        setError(
          json?.error === "INVALID_OPTION"
            ? "Questa opzione non è più selezionabile."
            : "Si è verificato un errore nella conferma della quotazione."
        );
        return;
      }

      setQuote((prev) =>
        prev
          ? {
              ...prev,
              status: "accettata",
              accepted_option_id: json.accepted_option_id || optionId,
            }
          : prev
      );

      setOptions((prev) =>
        prev.map((o) =>
          o.id === optionId
            ? { ...o, status: "accettata" }
            : { ...o, status: "rifiutata" }
        )
      );

      setThankYou(true);
    } catch (e) {
      console.error("[QuotePublicClient] accept error:", e);
      setError("Si è verificato un errore nella conferma della quotazione.");
    } finally {
      setAccepting(null);
    }
  }

  // ------------------ UI --------------------------------------------------------

  if (loading && !quote) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-xs text-slate-700 shadow-sm">
          <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
          <span>Caricamento quotazione…</span>
        </div>
      </div>
    );
  }

  if (error || !quote) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <div className="w-full max-w-md rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900 shadow-sm">
          <div className="mb-2 flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-rose-600" />
            <span className="font-semibold">Quotazione non disponibile</span>
          </div>
          <p className="text-xs text-rose-800">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-3xl flex-col px-4 py-8">
      {/* Top brand */}
      <div className="mb-6 flex items-center justify-between">
        <div className="inline-flex items-center gap-3">
          <div className="relative h-10 w-10 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <Image
              src="/spst-logo.png"
              alt="SPST"
              fill
              className="object-contain p-1"
              priority
            />
          </div>

          <div className="leading-tight">
            <div className="text-sm font-semibold text-slate-900">SPST</div>
            <div className="text-[11px] text-slate-500">Quotazione</div>
          </div>
        </div>

        <div className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] text-slate-600 shadow-sm">
          Preventivo{" "}
          <span className="font-semibold text-slate-900">
            {quote.human_id || quote.id}
          </span>
        </div>
      </div>

      {/* Hero */}
      <header className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-lg font-semibold text-slate-900">
              Scegli l’opzione di spedizione
            </h1>
            <p className="mt-1 text-xs text-slate-600">
              Link dedicato SPST: seleziona l’opzione che preferisci e ti
              ricontattiamo per conferma e prossimi step.
            </p>
          </div>

          <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] text-slate-700">
            <Clock className="h-3.5 w-3.5 text-slate-500" />
            <span>Richiesta del {formatDate(quote.created_at)}</span>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2 text-[11px]">
          {quote.data_ritiro && (
            <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-slate-700">
              <MapPin className="h-3 w-3 text-slate-500" />
              Ritiro: {formatDate(quote.data_ritiro)}
            </span>
          )}
          {quote.tipo_spedizione && (
            <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-slate-700">
              Tipo: {quote.tipo_spedizione}
            </span>
          )}
          {quote.incoterm && (
            <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-slate-700">
              Incoterm: {quote.incoterm}
            </span>
          )}

          {/* ✅ NEW assicurazione */}
          {insuranceActive && (
            <>
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-emerald-800">
                <ShieldCheck className="h-3 w-3 text-emerald-600" />
                Assicurazione: attiva
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-emerald-800">
                <ShieldCheck className="h-3 w-3 text-emerald-600" />
                Valore assicurato:{" "}
                {formatCurrency(quote.declared_value, quote.valuta || "EUR")}
              </span>
            </>
          )}
        </div>
      </header>

      {/* Accepted message */}
      {alreadyAccepted && (
        <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-900 shadow-sm">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            <span className="font-medium">La tua scelta è stata registrata.</span>
          </div>
          {thankYou && (
            <p className="mt-1 text-[11px] text-emerald-800">
              Grazie! Riceverai un riscontro da SPST con i prossimi step.
            </p>
          )}
        </div>
      )}

      {/* Shipment details */}
      <section className="mt-4 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-3 flex items-center gap-2">
          <Package className="h-4 w-4 text-slate-700" />
          <h2 className="text-sm font-semibold text-slate-900">Dettagli spedizione</h2>
        </div>

        <div className="grid gap-4">
          <div className="grid gap-3 md:grid-cols-2">
            {/* Mittente */}
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                Mittente
              </div>
              <div className="mt-1 text-sm font-semibold text-slate-900">
                {ship.mitt.title}
              </div>
              <div className="mt-2 space-y-1 text-[12px] text-slate-700">
                {ship.mitt.lines.length ? (
                  ship.mitt.lines.map((l, i) => <div key={i}>{l}</div>)
                ) : (
                  <div className="text-slate-500">—</div>
                )}
              </div>
            </div>

            {/* Destinatario */}
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                Destinatario
              </div>
              <div className="mt-1 text-sm font-semibold text-slate-900">
                {ship.dest.title}
              </div>
              <div className="mt-2 space-y-1 text-[12px] text-slate-700">
                {ship.dest.lines.length ? (
                  ship.dest.lines.map((l, i) => <div key={i}>{l}</div>)
                ) : (
                  <div className="text-slate-500">—</div>
                )}
              </div>
            </div>
          </div>

          {/* Colli + volumetrico */}
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                  Colli
                </div>

                <div className="mt-1 flex flex-wrap gap-2 text-[12px] text-slate-700">
                  <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5">
                    <Package className="h-3 w-3 text-slate-500" />
                    Totale:{" "}
                    <span className="font-semibold text-slate-900">
                      {ship.totalPieces || ship.colli.length || 0}
                    </span>
                  </span>

                  <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5">
                    <Weight className="h-3 w-3 text-slate-500" />
                    Peso reale:{" "}
                    <span className="font-semibold text-slate-900">
                      {(ship.totalWeight || 0).toFixed(1)} kg
                    </span>
                  </span>

                  <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5">
                    <Ruler className="h-3 w-3 text-slate-500" />
                    Peso volumetrico:{" "}
                    <span className="font-semibold text-slate-900">
                      {ship.volumetricWeightKg > 0
                        ? `${ship.volumetricWeightKg.toFixed(1)} kg`
                        : "—"}
                    </span>
                    <span className="text-[10px] text-slate-500">(÷ {ship.volDivisor})</span>
                  </span>

                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-emerald-900">
                    <Weight className="h-3 w-3 text-emerald-700" />
                    Peso tassato:{" "}
                    <span className="font-semibold">
                      {ship.billedWeightKg > 0 ? `${ship.billedWeightKg.toFixed(1)} kg` : "—"}
                    </span>
                  </span>
                </div>
              </div>

              {quote.contenuto_colli ? (
                <div className="max-w-full rounded-full bg-slate-100 px-3 py-1 text-[11px] text-slate-700">
                  Contenuto: <span className="font-semibold">{quote.contenuto_colli}</span>
                </div>
              ) : null}
            </div>

            {ship.colli.length > 0 && (
              <div className="mt-3 overflow-x-auto">
                <table className="w-full text-left text-[12px]">
                  <thead>
                    <tr className="text-[10px] uppercase tracking-wide text-slate-500">
                      <th className="py-2 pr-3">Q.tà</th>
                      <th className="py-2 pr-3">Dimensioni (cm)</th>
                      <th className="py-2 pr-0 text-right">Peso (kg)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {ship.colli.map((c, i) => {
                      const q = n(c.quantita) ?? 1;
                      const l1 = n(c.lunghezza_cm);
                      const l2 = n(c.larghezza_cm);
                      const l3 = n(c.altezza_cm);
                      const dims = l1 && l2 && l3 ? `${l1}×${l2}×${l3}` : "—";
                      const w = n(c.peso_kg);

                      return (
                        <tr key={i} className="text-slate-800">
                          <td className="py-2 pr-3 font-medium">{q}</td>
                          <td className="py-2 pr-3">{dims}</td>
                          <td className="py-2 pr-0 text-right font-medium">
                            {w != null ? w.toFixed(2) : "—"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>

                <div className="mt-2 text-[10px] text-slate-500">
                  Peso volumetrico = (L×W×H in cm) ÷ {ship.volDivisor}. Il{" "}
                  <span className="font-semibold">peso tassato</span> è il valore più alto tra
                  peso reale e peso volumetrico.
                </div>
              </div>
            )}
          </div>

          <div className="grid gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            {fieldLine("Email cliente", quote.email_cliente)}
            {fieldLine("Valuta", quote.valuta)}
            {fieldLine("Stato", quote.status)}
            {/* ✅ opzionale: mostra assicurazione anche qui */}
            {insuranceActive
              ? fieldLine(
                  "Valore assicurato",
                  formatCurrency(quote.declared_value, quote.valuta || "EUR")
                )
              : null}
          </div>
        </div>
      </section>

      {/* Options */}
      <main className="mt-4 flex-1">
        {options.length === 0 ? (
          <div className="rounded-3xl border border-slate-200 bg-white p-5 text-sm text-slate-700 shadow-sm">
            Al momento non sono ancora state caricate opzioni per questa quotazione. Ti invitiamo
            a riprovare più tardi o a contattare SPST.
          </div>
        ) : (
          <div className="grid gap-3">
            {options.map((opt, idx) => {
              const freight = opt.freight_price ?? 0;
              const customs = opt.customs_price ?? 0;
              const total = opt.total_price ?? freight + customs;
              const currency = opt.currency || quote.valuta || "EUR";

              const ivaIncluded = !!opt.show_vat;
              const vatRate = opt.vat_rate ?? null;

              const isAccepted =
                quote.accepted_option_id === opt.id || opt.status === "accettata";
              const isRejected = opt.status === "rifiutata";
              const disabled = alreadyAccepted && !isAccepted;

              return (
                <div
                  key={opt.id}
                  className={[
                    "rounded-3xl border bg-white p-5 shadow-sm transition",
                    isAccepted
                      ? "border-emerald-200 ring-2 ring-emerald-200"
                      : isRejected
                      ? "border-slate-200 opacity-70"
                      : "border-slate-200 hover:border-slate-300",
                  ].join(" ")}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="inline-flex items-center gap-2">
                        <span className="text-[10px] uppercase tracking-wide text-slate-500">
                          {opt.label || `Opzione ${idx + 1}`}
                        </span>

                        {isAccepted && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-800 ring-1 ring-emerald-200">
                            <CheckCircle2 className="h-3 w-3" />
                            Scelta
                          </span>
                        )}

                        {isRejected && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-600">
                            Non selezionata
                          </span>
                        )}
                      </div>

                      <div className="mt-1 text-base font-semibold text-slate-900">
                        {opt.carrier || "Corriere"} · {opt.service_name || "Servizio"}
                      </div>

                      {opt.transit_time && (
                        <div className="mt-2 inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-700">
                          <Clock className="h-3 w-3 text-slate-500" />
                          Transit time stimato: {opt.transit_time}
                        </div>
                      )}
                    </div>

                    <div className="min-w-[220px] text-right">
                      <div className="text-[11px] text-slate-500">Totale spedizione</div>
                      <div className="text-2xl font-semibold text-slate-900">
                        {formatCurrency(total, currency)}
                      </div>

                      {/* ✅ cambio testo IVA */}
                      <div className="mt-1 text-[11px] text-slate-500">
                        {ivaIncluded
                          ? vatRate
                            ? `IVA ${vatRate}% inclusa`
                            : "IVA inclusa"
                          : vatRate
                          ? `+${vatRate}% IVA`
                          : "+IVA"}
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-2 md:grid-cols-2">
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                      <div className="text-[10px] uppercase tracking-wide text-slate-500">
                        Nolo
                      </div>
                      <div className="mt-1 text-sm font-semibold text-slate-900">
                        {formatCurrency(freight, currency)}
                      </div>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                      <div className="text-[10px] uppercase tracking-wide text-slate-500">
                        Costi doganali e fiscali
                      </div>
                      <div className="mt-1 text-sm font-semibold text-slate-900">
                        {formatCurrency(customs, currency)}
                      </div>
                    </div>
                  </div>

                  {opt.public_notes && (
                    <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-3">
                      <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                        Note operative
                      </div>
                      <p className="whitespace-pre-wrap text-[12px] text-slate-700">
                        {opt.public_notes}
                      </p>
                    </div>
                  )}

                  <div className="mt-5 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                    <div className="text-[11px] text-slate-500">
                      Cliccando su <span className="font-semibold">Conferma questa opzione</span>{" "}
                      ci autorizzi a procedere con questa soluzione.
                    </div>

                    <button
                      type="button"
                      disabled={disabled || accepting === opt.id}
                      onClick={() => handleAccept(opt.id)}
                      className={[
                        "inline-flex items-center justify-center rounded-full px-4 py-2 text-[12px] font-semibold transition",
                        disabled
                          ? "cursor-not-allowed border border-slate-200 bg-slate-100 text-slate-400"
                          : isAccepted
                          ? "border border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100"
                          : "bg-emerald-600 text-white hover:bg-emerald-500",
                      ].join(" ")}
                    >
                      {accepting === opt.id ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Invio…
                        </>
                      ) : isAccepted ? (
                        <>
                          <CheckCircle2 className="mr-2 h-4 w-4" />
                          Opzione confermata
                        </>
                      ) : (
                        <>Conferma questa opzione</>
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      <footer className="mt-8 border-t border-slate-100 pt-4 text-[11px] text-slate-500">
        Quotazione gestita da <span className="font-semibold text-slate-900">SPST</span>. In caso
        di dubbi puoi rispondere direttamente alla mail con cui hai ricevuto questo link.
      </footer>
    </div>
  );
}
