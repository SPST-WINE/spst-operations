// components/public/QuotePublicClient.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Clock, AlertCircle, Loader2 } from "lucide-react";

type Props = {
  token: string;
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
  mittente: any | null;
  destinatario: any | null;
  accepted_option_id: string | null;
};

type PublicQuoteOption = {
  id: string;
  quote_id: string;
  label: string | null;
  carrier: string | null;
  service_name: string | null;
  transit_time: string | null;
  total_price: number | null;
  currency: string | null;
  public_notes: string | null;
  status: string | null;
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

      // aggiorno stato locale
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
        <div className="inline-flex items-center gap-2 rounded-full bg-slate-900/80 px-4 py-2 text-xs text-slate-200 shadow-lg shadow-black/40">
          <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
          <span>Caricamento della quotazione in corso...</span>
        </div>
      </div>
    );
  }

  if (error || !quote) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <div className="max-w-md rounded-2xl border border-red-500/40 bg-red-950/60 p-4 text-sm text-red-50 shadow-xl shadow-black/50">
          <div className="mb-2 flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-red-300" />
            <span className="font-semibold">Quotazione non disponibile</span>
          </div>
          <p className="text-xs text-red-100">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-4xl flex-col px-4 py-8">
      {/* Header */}
      <header className="mb-6">
        <div className="inline-flex items-center gap-2 rounded-full bg-slate-900/80 px-3 py-1 text-[11px] text-slate-200">
          <span className="text-slate-400">Preventivo</span>
          <span className="font-medium text-slate-50">
            {quote.human_id || quote.id}
          </span>
        </div>

        <h1 className="mt-3 text-xl font-semibold text-slate-50">
          Seleziona l&apos;opzione di spedizione che preferisci
        </h1>
        <p className="mt-1 text-xs text-slate-300">
          Questo è un link dedicato per la tua quotazione SPST. Scegli
          l&apos;opzione più adatta alle tue esigenze, ti ricontatteremo per
          confermare la spedizione.
        </p>

        <div className="mt-3 flex flex-wrap items-center gap-3 text-[11px] text-slate-300">
          <span className="inline-flex items-center gap-1 rounded-full bg-slate-900/70 px-2 py-0.5">
            <Clock className="h-3 w-3 text-slate-400" />
            <span>Richiesta del {formatDate(quote.created_at)}</span>
          </span>
          {quote.data_ritiro && (
            <span className="inline-flex items-center gap-1 rounded-full bg-slate-900/70 px-2 py-0.5">
              Data ritiro desiderata: {formatDate(quote.data_ritiro)}
            </span>
          )}
          {quote.tipo_spedizione && (
            <span className="inline-flex items-center gap-1 rounded-full bg-slate-900/70 px-2 py-0.5">
              Tipo spedizione: {quote.tipo_spedizione}
            </span>
          )}
          {quote.incoterm && (
            <span className="inline-flex items-center gap-1 rounded-full bg-slate-900/70 px-2 py-0.5">
              Incoterm: {quote.incoterm}
            </span>
          )}
        </div>
      </header>

      {/* Messaggio di conferma se già accettata */}
      {alreadyAccepted && (
        <div className="mb-4 rounded-2xl border border-emerald-500/40 bg-emerald-950/60 p-3 text-xs text-emerald-50 shadow-lg shadow-black/40">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-300" />
            <span className="font-medium">
              La tua scelta è già stata registrata.
            </span>
          </div>
          {thankYou && (
            <p className="mt-1 text-[11px] text-emerald-100">
              Grazie, riceverai un riscontro da SPST con i prossimi step.
            </p>
          )}
        </div>
      )}

      {/* Opzioni */}
      <main className="flex-1">
        {options.length === 0 ? (
          <div className="mt-8 rounded-2xl border border-slate-700/60 bg-slate-900/60 p-4 text-xs text-slate-200 shadow-lg shadow-black/40">
            Al momento non sono ancora state caricate opzioni per questa
            quotazione. Ti invitiamo a riprovare più tardi o a contattare SPST.
          </div>
        ) : (
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            {options.map((opt, idx) => {
              const isAccepted =
                quote.accepted_option_id === opt.id || opt.status === "accettata";
              const isRejected = opt.status === "rifiutata";
              const disabled = alreadyAccepted && !isAccepted;

              return (
                <div
                  key={opt.id}
                  className={[
                    "relative flex flex-col rounded-2xl border bg-slate-900/80 p-4 text-xs shadow-lg shadow-black/40 transition",
                    isAccepted
                      ? "border-emerald-500/70 ring-2 ring-emerald-500/60"
                      : isRejected
                      ? "border-slate-700/60 opacity-70"
                      : "border-slate-700/80 hover:border-slate-500 hover:-translate-y-0.5",
                  ].join(" ")}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="inline-flex items-center gap-2">
                        <span className="text-[11px] uppercase tracking-wide text-slate-400">
                          {opt.label || `Opzione ${idx + 1}`}
                        </span>
                        {isAccepted && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-200 ring-1 ring-emerald-500/40">
                            <CheckCircle2 className="h-3 w-3" />
                            Scelta
                          </span>
                        )}
                        {isRejected && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-slate-800 px-2 py-0.5 text-[10px] text-slate-300">
                            Non selezionata
                          </span>
                        )}
                      </div>
                      <div className="mt-1 text-sm font-medium text-slate-50">
                        {opt.carrier || "Corriere"} ·{" "}
                        {opt.service_name || "Servizio"}
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="text-[11px] text-slate-400">
                        Totale spedizione
                      </div>
                      <div className="text-base font-semibold text-slate-50">
                        {formatCurrency(opt.total_price, opt.currency || quote.valuta)}
                      </div>
                    </div>
                  </div>

                  {opt.transit_time && (
                    <div className="mt-2 inline-flex items-center gap-1 rounded-full bg-slate-800 px-2 py-0.5 text-[10px] text-slate-300">
                      <Clock className="h-3 w-3 text-slate-400" />
                      <span>Transit time stimato: {opt.transit_time}</span>
                    </div>
                  )}

                  {opt.public_notes && (
                    <div className="mt-3 rounded-xl bg-slate-900/80 p-2 text-[11px] text-slate-200">
                      <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                        Note operative
                      </div>
                      <p className="whitespace-pre-wrap">{opt.public_notes}</p>
                    </div>
                  )}

                  <div className="mt-4 flex items-center justify-between gap-2">
                    <span className="text-[10px] text-slate-400">
                      Cliccando su &quot;Conferma questa opzione&quot; ci
                      autorizzi a procedere con questa soluzione di trasporto.
                    </span>

                    <button
                      type="button"
                      disabled={disabled || accepting === opt.id}
                      onClick={() => handleAccept(opt.id)}
                      className={[
                        "inline-flex items-center justify-center rounded-full px-3 py-1.5 text-[11px] font-medium transition",
                        disabled
                          ? "bg-slate-800 text-slate-400 cursor-not-allowed"
                          : "bg-emerald-500 text-emerald-950 hover:bg-emerald-400",
                      ].join(" ")}
                    >
                      {accepting === opt.id ? (
                        <>
                          <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                          Invio...
                        </>
                      ) : isAccepted ? (
                        <>
                          <CheckCircle2 className="mr-1 h-3 w-3" />
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

      {/* Footer mini brand */}
      <footer className="mt-8 border-t border-slate-800/80 pt-4 text-[10px] text-slate-500">
        Quotazione gestita da <span className="font-semibold">SPST</span>. In
        caso di dubbi puoi rispondere direttamente alla mail con cui hai
        ricevuto questo link.
      </footer>
    </div>
  );
}
