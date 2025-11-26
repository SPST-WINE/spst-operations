// components/backoffice/BackofficeQuoteDetailClient.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Loader2, ExternalLink, Globe2, Copy, Check } from "lucide-react";

type Props = {
  id: string;
};

type QuoteDetail = {
  id: string;
  human_id: string | null;
  status: string | null;
  declared_value: number | null;
  incoterm: string | null;
  created_at: string | null;
  origin: string | null;
  email_cliente: string | null;
  creato_da_email: string | null;
  data_ritiro: string | null;
  tipo_spedizione: string | null;
  valuta: string | null;
  note_generiche: string | null;
  mittente: any | null;
  destinatario: any | null;
  colli: any | null;
  public_token: string | null;
  accepted_option_id: string | null;
  updated_at: string | null;
  fields: any;
};

type QuoteOptionRow = {
  id: string;
  quote_id: string;
  label: string | null;
  carrier: string | null;
  service_name: string | null;
  transit_time?: string | null;
  total_price: number | null;
  currency: string | null;
  internal_cost: number | null;
  internal_profit: number | null;
  status: string | null;
  sent_at: string | null;
  created_at: string | null;
};

function StatusBadge({ value }: { value?: string | null }) {
  const v = (value || "").toLowerCase();
  let cls = "bg-slate-50 text-slate-700 ring-slate-200";
  let label = value || "—";

  if (v.includes("nuova")) {
    cls = "bg-sky-50 text-sky-700 ring-sky-200";
  } else if (v.includes("lavoraz")) {
    cls = "bg-amber-50 text-amber-700 ring-amber-200";
  } else if (v.includes("inviata")) {
    cls = "bg-indigo-50 text-indigo-700 ring-indigo-200";
  } else if (v.includes("accettata")) {
    cls = "bg-emerald-50 text-emerald-700 ring-emerald-200";
  } else if (v.includes("rifiutata") || v.includes("scaduta")) {
    cls = "bg-rose-50 text-rose-700 ring-rose-200";
  }

  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs ring-1 ${cls}`}
    >
      {label}
    </span>
  );
}

function formatDateTime(s?: string | null) {
  if (!s) return "—";
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return s;
  return d.toLocaleString("it-IT", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDate(s?: string | null) {
  if (!s) return "—";
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return s;
  return d.toLocaleDateString("it-IT");
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

function InfoRow({
  label,
  value,
}: {
  label: string;
  value?: string | null;
}) {
  return (
    <div className="flex justify-between gap-4 text-xs">
      <span className="text-slate-500">{label}</span>
      <span className="max-w-[60%] text-right text-slate-800">
        {value && value.trim() !== "" ? value : "—"}
      </span>
    </div>
  );
}

export default function BackofficeQuoteDetailClient({ id }: Props) {
  const [quote, setQuote] = useState<QuoteDetail | null>(null);
  const [options, setOptions] = useState<QuoteOptionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingOptions, setLoadingOptions] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingOption, setSavingOption] = useState(false);

  const [creatingLink, setCreatingLink] = useState(false);
  const [linkMsg, setLinkMsg] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // stato base "nuova opzione" (form semplice per ora)
  const [newOption, setNewOption] = useState({
    label: "Opzione A",
    carrier: "",
    service_name: "",
    transit_time: "",
    freight_price: "",
    customs_price: "",
    total_price: "",
    currency: "EUR",
    public_notes: "",
    internal_cost: "",
    internal_profit: "",
    visible_to_client: true,
    show_vat: false,
    vat_rate: "22", // default B2B Italia
  });
  const [optionMsg, setOptionMsg] = useState<string | null>(null);

  // Toggle JSON completo per mittente/destinatario/colli
  const [showMittenteJson, setShowMittenteJson] = useState(false);
  const [showDestinatarioJson, setShowDestinatarioJson] = useState(false);
  const [showColliJson, setShowColliJson] = useState(false);

  const publicUrl = useMemo(() => {
    if (!quote?.public_token) return null;
    // NB: in dev potresti voler usare NEXT_PUBLIC_BASE_URL, qui hardcodiamo il dominio prod
    return `https://spst-operations.vercel.app/quote/${quote.public_token}`;
  }, [quote?.public_token]);

  // ------- Load quote + options ---------------------------------------------------

  useEffect(() => {
    let active = true;

    async function load() {
      setLoading(true);
      setError(null);

      try {
        const res = await fetch(`/api/quote-requests/${id}`, {
          cache: "no-store",
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        if (!active) return;

        if (json?.ok && json.quote) {
          setQuote(json.quote as QuoteDetail);
        } else {
          throw new Error("Risposta API non valida");
        }
      } catch (e: any) {
        console.error("[BackofficeQuoteDetail] load quote error:", e);
        if (active) {
          setError("Impossibile caricare i dati della richiesta.");
          setQuote(null);
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    async function loadOptions() {
      setLoadingOptions(true);
      try {
        const res = await fetch(`/api/quote-requests/${id}/options`, {
          cache: "no-store",
        });
        const json = await res.json().catch(() => ({}));
        if (!active) return;

        if (json?.ok && Array.isArray(json.options)) {
          setOptions(json.options as QuoteOptionRow[]);
        } else {
          setOptions([]);
        }
      } catch (e) {
        console.error("[BackofficeQuoteDetail] load options error:", e);
        if (active) setOptions([]);
      } finally {
        if (active) setLoadingOptions(false);
      }
    }

    load();
    loadOptions();

    return () => {
      active = false;
    };
  }, [id]);

  // ------- Handlers --------------------------------------------------------------

  async function handleCreatePublicLink() {
    if (!quote) return;
    setCreatingLink(true);
    setLinkMsg(null);
    setCopied(false);

    try {
      const res = await fetch(`/api/quote-requests/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ generatePublicToken: true }),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.ok || !json.quote) {
        throw new Error(json?.error || `HTTP ${res.status}`);
      }

      setQuote(json.quote as QuoteDetail);
      setLinkMsg("Link pubblico generato / aggiornato.");
    } catch (e: any) {
      console.error("[BackofficeQuoteDetail] create link error:", e);
      setLinkMsg("Errore nella generazione del link pubblico.");
    } finally {
      setCreatingLink(false);
    }
  }

  async function handleCopyLink() {
    if (!publicUrl) return;
    try {
      await navigator.clipboard.writeText(publicUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      console.error("Clipboard error:", e);
    }
  }

  async function handleSaveNewOption(e: React.FormEvent) {
    e.preventDefault();
    if (!quote) return;
    setSavingOption(true);
    setOptionMsg(null);

    try {
      const body = {
        label: newOption.label || null,
        carrier: newOption.carrier || null,
        service_name: newOption.service_name || null,
        transit_time: newOption.transit_time || null,
        freight_price: newOption.freight_price
          ? Number(newOption.freight_price)
          : null,
        customs_price: newOption.customs_price
          ? Number(newOption.customs_price)
          : null,
        total_price: newOption.total_price
          ? Number(newOption.total_price)
          : null,
        currency: newOption.currency || "EUR",
        public_notes: newOption.public_notes || null,
        internal_cost: newOption.internal_cost
          ? Number(newOption.internal_cost)
          : null,
        internal_profit: newOption.internal_profit
          ? Number(newOption.internal_profit)
          : null,
        visible_to_client: newOption.visible_to_client,
        status: "bozza",
        show_vat: newOption.show_vat,
        vat_rate: newOption.vat_rate ? Number(newOption.vat_rate) : null,
      };

      const res = await fetch(`/api/quote-requests/${id}/options`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.ok || !json.option) {
        throw new Error(json?.error || `HTTP ${res.status}`);
      }

      // aggiorno lista opzioni
      setOptions((prev) => [...prev, json.option as QuoteOptionRow]);

      setOptionMsg("Opzione salvata come bozza.");
    } catch (e: any) {
      console.error("[BackofficeQuoteDetail] save option error:", e);
      setOptionMsg("Errore nel salvataggio dell'opzione.");
    } finally {
      setSavingOption(false);
    }
  }

  // ------- Derived ---------------------------------------------------------------

  const baseInfo = useMemo(() => {
    if (!quote) return null;
    return {
      id: quote.id,
      human: quote.human_id || quote.id,
      stato: quote.status || "—",
      created_at: quote.created_at,
      data_ritiro: quote.data_ritiro,
      tipo_spedizione: quote.tipo_spedizione || "—",
      incoterm: quote.incoterm || "—",
      valuta: quote.valuta || "EUR",
    };
  }, [quote]);

  // ------- Render ----------------------------------------------------------------

  if (loading && !quote) {
    return (
      <div className="flex items-center justify-center py-10">
        <div className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-xs text-slate-600 shadow-sm">
          <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
          <span>Carico i dettagli della richiesta di quotazione...</span>
        </div>
      </div>
    );
  }

  if (error || !quote || !baseInfo) {
    return (
      <div className="rounded-2xl border border-rose-100 bg-rose-50/60 p-4 text-sm text-rose-700">
        {error || "Richiesta di quotazione non trovata."}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-base font-semibold text-slate-900">
              {baseInfo.human}
            </h1>
            <StatusBadge value={baseInfo.stato} />
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Richiesta di quotazione ricevuta dalla dashboard cliente.
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-start gap-2 sm:justify-end">
          <Link
            href="/back-office/quotazioni"
            className="inline-flex items-center rounded-full border border-slate-200 px-3 py-1.5 text-[11px] text-slate-700 hover:border-slate-300 hover:bg-slate-50"
          >
            ← Torna alla lista
          </Link>
        </div>
      </div>

      {/* Layout principale: 2 colonne */}
      <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1.5fr)]">
        {/* Colonna sinistra: info richiesta */}
        <div className="space-y-4">
          {/* Dati generali */}
          <div className="rounded-2xl border bg-white p-4">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                  Dati generali
                </h2>
                <p className="mt-0.5 text-[11px] text-slate-500">
                  Informazioni principali sulla richiesta di quotazione.
                </p>
              </div>
            </div>

            <div className="mt-3 space-y-2">
              <InfoRow
                label="Creata il"
                value={formatDateTime(baseInfo.created_at)}
              />
              <InfoRow
                label="Data ritiro"
                value={formatDate(baseInfo.data_ritiro)}
              />
              <InfoRow
                label="Tipo spedizione"
                value={quote.tipo_spedizione || "—"}
              />
              <InfoRow label="Incoterm" value={quote.incoterm || "—"} />
              <InfoRow label="Valuta" value={quote.valuta || "EUR"} />
              <InfoRow
                label="Email cliente"
                value={quote.email_cliente || "—"}
              />
              <InfoRow label="Origine" value={quote.origin || "dashboard"} />
            </div>

            {quote.note_generiche && (
              <div className="mt-3 rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-700">
                <div className="mb-1 text-[11px] font-medium text-slate-500">
                  Note generali
                </div>
                <div className="whitespace-pre-wrap">
                  {quote.note_generiche}
                </div>
              </div>
            )}
          </div>

          {/* Mittente / Destinatario con toggle JSON */}
          <div className="rounded-2xl border bg-white p-4">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                Mittente &amp; Destinatario
              </h2>
            </div>

            <div className="mt-3 grid gap-3 md:grid-cols-2">
              {/* MITTENTE */}
              <div className="rounded-xl border bg-white p-4 shadow-sm">
                <div className="mb-2 text-sm font-semibold">MITTENTE</div>

                <div className="text-sm font-medium">
                  {quote?.mittente?.ragioneSociale || "—"}
                </div>
                <div className="text-sm text-slate-600">
                  {[
                    quote?.mittente?.indirizzo,
                    quote?.mittente?.cap,
                    quote?.mittente?.citta,
                    quote?.mittente?.paese,
                  ]
                    .filter(Boolean)
                    .join(", ") || "—"}
                </div>

                <button
                  type="button"
                  onClick={() => setShowMittenteJson((v) => !v)}
                  className="mt-2 text-[11px] text-slate-500 underline-offset-2 hover:underline"
                >
                  {showMittenteJson
                    ? "Nascondi dati mittente nel JSON originale"
                    : "Vedi dati mittente nel JSON originale"}
                </button>

                {showMittenteJson && (
                  <pre className="mt-2 max-h-64 overflow-auto rounded-lg bg-slate-900 p-3 text-[11px] text-slate-100">
                    {JSON.stringify(
                      quote?.mittente ??
                        quote?.fields?.mittente ??
                        quote?.fields?.mittente_json ??
                        {},
                      null,
                      2,
                    )}
                  </pre>
                )}
              </div>

              {/* DESTINATARIO */}
              <div className="rounded-xl border bg-white p-4 shadow-sm">
                <div className="mb-2 text-sm font-semibold">DESTINATARIO</div>

                <div className="text-sm font-medium">
                  {quote?.destinatario?.ragioneSociale || "—"}
                </div>
                <div className="text-sm text-slate-600">
                  {[
                    quote?.destinatario?.indirizzo,
                    quote?.destinatario?.cap,
                    quote?.destinatario?.citta,
                    quote?.destinatario?.paese,
                  ]
                    .filter(Boolean)
                    .join(", ") || "—"}
                </div>

                <button
                  type="button"
                  onClick={() => setShowDestinatarioJson((v) => !v)}
                  className="mt-2 text-[11px] text-slate-500 underline-offset-2 hover:underline"
                >
                  {showDestinatarioJson
                    ? "Nascondi dati destinatario nel JSON originale"
                    : "Vedi dati destinatario nel JSON originale"}
                </button>

                {showDestinatarioJson && (
                  <pre className="mt-2 max-h-64 overflow-auto rounded-lg bg-slate-900 p-3 text-[11px] text-slate-100">
                    {JSON.stringify(
                      quote?.destinatario ??
                        quote?.fields?.destinatario ??
                        quote?.fields?.destinatario_json ??
                        {},
                      null,
                      2,
                    )}
                  </pre>
                )}
              </div>
            </div>
          </div>

          {/* Colli / debug JSON con toggle */}
          <div className="rounded-2xl border bg-white p-4">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                Colli &amp; dati tecnici
              </h2>

              {quote?.colli && (
                <button
                  type="button"
                  onClick={() => setShowColliJson((v) => !v)}
                  className="text-[11px] font-normal text-slate-500 underline-offset-2 hover:underline"
                >
                  {showColliJson
                    ? "Nascondi JSON completo"
                    : "Vedi JSON completo (debug)"}
                </button>
              )}
            </div>

            {/* riepilogo/JSON colli che avevi già */}
            {quote.colli ? (
              <div className="mt-2 rounded-xl bg-slate-50 p-3 text-xs text-slate-800">
                <div className="text-[11px] font-medium text-slate-500">
                  Colli
                </div>
                <pre className="mt-1 whitespace-pre-wrap break-words text-[11px]">
                  {JSON.stringify(quote.colli, null, 2)}
                </pre>
              </div>
            ) : (
              <p className="mt-2 text-xs text-slate-500">
                I dettagli dei colli sono presenti nel JSON originale della
                richiesta.
              </p>
            )}

            {showColliJson && (
              <pre className="mt-3 max-h-72 overflow-auto rounded-lg bg-slate-900 p-3 text-[11px] text-slate-100">
                {JSON.stringify(
                  quote?.colli ??
                    quote?.fields?.colli ??
                    quote?.fields?.colli_debug ??
                    [],
                  null,
                  2,
                )}
              </pre>
            )}

            {/* se ti serve ancora il JSON totale raw, puoi lasciare questo block: */}
            {/* 
            <details className="mt-3">
              <summary className="cursor-pointer text-[11px] text-slate-500">
                Vedi JSON completo richiesta (raw)
              </summary>
              <pre className="mt-2 max-h-64 overflow-auto rounded-lg bg-slate-900/95 p-3 text-[11px] text-slate-100">
                {JSON.stringify(quote.fields, null, 2)}
              </pre>
            </details>
            */}
          </div>
        </div>

        {/* Colonna destra: link pubblico + opzioni */}
        <div className="space-y-4">
          {/* Link pubblico */}
          <div className="rounded-2xl border bg-white p-4">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                  Link pubblico quotazione
                </h2>
                <p className="mt-0.5 text-[11px] text-slate-500">
                  Genera un link pubblico da condividere con il cliente per
                  permettergli di scegliere l&apos;opzione preferita.
                </p>
              </div>
            </div>

            <div className="mt-3 space-y-2">
              <button
                type="button"
                onClick={handleCreatePublicLink}
                disabled={creatingLink}
                className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-3 py-1.5 text-[11px] font-medium text-white hover:bg-slate-800 disabled:opacity-60"
              >
                {creatingLink ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Globe2 className="h-3 w-3" />
                )}
                <span>Crea quotazione con link pubblico</span>
              </button>

              {linkMsg && (
                <p className="text-[11px] text-slate-500">{linkMsg}</p>
              )}

              {publicUrl && (
                <div className="mt-2 flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2">
                  <div className="flex-1 truncate text-[11px] text-slate-700">
                    {publicUrl}
                  </div>
                  <button
                    type="button"
                    onClick={handleCopyLink}
                    className="inline-flex items-center gap-1 rounded-full border border-slate-200 px-2 py-1 text-[10px] text-slate-700 hover:border-slate-300 hover:bg-slate-100"
                  >
                    {copied ? (
                      <>
                        <Check className="h-3 w-3" />
                        <span>Copiato</span>
                      </>
                    ) : (
                      <>
                        <Copy className="h-3 w-3" />
                        <span>Copia</span>
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Lista opzioni esistenti */}
          <div className="rounded-2xl border bg-white p-4">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                Opzioni quotazione
              </h2>
              <span className="text-[11px] text-slate-500">
                {options.length} opzioni
              </span>
            </div>

            <div className="mt-3 divide-y border-t border-slate-100">
              {loadingOptions ? (
                <div className="py-4 text-center text-[11px] text-slate-500">
                  Carico le opzioni...
                </div>
              ) : options.length === 0 ? (
                <div className="py-4 text-center text-[11px] text-slate-500">
                  Nessuna opzione ancora creata per questa richiesta.
                </div>
              ) : (
                options.map((o) => {
                  const margin =
                    o.internal_profit != null
                      ? o.internal_profit
                      : o.internal_cost != null && o.total_price != null
                      ? o.total_price - o.internal_cost
                      : null;

                  return (
                    <div
                      key={o.id}
                      className="flex flex-col gap-2 py-3 text-xs sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium text-slate-900">
                            {o.label || "Opzione"}
                          </span>
                          <StatusBadge value={o.status} />
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-600">
                          <span>
                            {o.carrier || "—"} · {o.service_name || "—"}
                          </span>
                          {o.transit_time && (
                            <>
                              <span className="h-1 w-1 rounded-full bg-slate-300" />
                              <span>{o.transit_time}</span>
                            </>
                          )}
                          <span className="h-1 w-1 rounded-full bg-slate-300" />
                          <span>
                            Totale cliente:{" "}
                            {formatCurrency(o.total_price || 0, o.currency)}
                          </span>
                          {o.internal_cost != null && (
                            <>
                              <span className="h-1 w-1 rounded-full bg-slate-300" />
                              <span>
                                Costo interno:{" "}
                                  {formatCurrency(o.internal_cost, o.currency)}
                              </span>
                            </>
                          )}
                          {margin != null && (
                            <>
                              <span className="h-1 w-1 rounded-full bg-slate-300" />
                              <span>
                                Margine: {formatCurrency(margin, o.currency)}
                              </span>
                            </>
                          )}
                          {o.sent_at && (
                            <>
                              <span className="h-1 w-1 rounded-full bg-slate-300" />
                              <span>Inviata: {formatDateTime(o.sent_at)}</span>
                            </>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-1 text-[11px]">
                        <span className="rounded-full bg-slate-50 px-2 py-0.5 text-slate-500">
                          ID opzione: {o.id.slice(0, 8)}…
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Form nuova opzione */}
          <div className="rounded-2xl border bg-white p-4">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                Aggiungi opzione (bozza)
              </h2>
              {optionMsg && (
                <span className="text-[11px] text-slate-500">{optionMsg}</span>
              )}
            </div>

            <form
              className="mt-3 space-y-3 text-[11px]"
              onSubmit={handleSaveNewOption}
            >
              <div className="grid gap-2 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-slate-500">Label</label>
                  <input
                    type="text"
                    value={newOption.label}
                    onChange={(e) =>
                      setNewOption((prev) => ({
                        ...prev,
                        label: e.target.value,
                      }))
                    }
                    className="w-full rounded-lg border border-slate-200 px-2 py-1 text-xs text-slate-900 focus:border-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-300"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-slate-500">Carrier</label>
                  <input
                    type="text"
                    value={newOption.carrier}
                    onChange={(e) =>
                      setNewOption((prev) => ({
                        ...prev,
                        carrier: e.target.value,
                      }))
                    }
                    className="w-full rounded-lg border border-slate-200 px-2 py-1 text-xs text-slate-900 focus:border-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-300"
                  />
                </div>
              </div>

              <div className="grid gap-2 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-slate-500">Servizio</label>
                  <input
                    type="text"
                    value={newOption.service_name}
                    onChange={(e) =>
                      setNewOption((prev) => ({
                        ...prev,
                        service_name: e.target.value,
                      }))
                    }
                    className="w-full rounded-lg border border-slate-200 px-2 py-1 text-xs text-slate-900 focus:border-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-300"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-slate-500">
                    Transit time
                  </label>
                  <input
                    type="text"
                    value={newOption.transit_time}
                    onChange={(e) =>
                      setNewOption((prev) => ({
                        ...prev,
                        transit_time: e.target.value,
                      }))
                    }
                    className="w-full rounded-lg border border-slate-200 px-2 py-1 text-xs text-slate-900 focus:border-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-300"
                  />
                </div>
              </div>

              <div className="grid gap-2 sm:grid-cols-3">
                <div>
                  <label className="mb-1 block text-slate-500">Nolo (€)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={newOption.freight_price}
                    onChange={(e) =>
                      setNewOption((prev) => ({
                        ...prev,
                        freight_price: e.target.value,
                      }))
                    }
                    className="w-full rounded-lg border border-slate-200 px-2 py-1 text-xs"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-slate-500">
                    Dogana (€)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={newOption.customs_price}
                    onChange={(e) =>
                      setNewOption((prev) => ({
                        ...prev,
                        customs_price: e.target.value,
                      }))
                    }
                    className="w-full rounded-lg border border-slate-200 px-2 py-1 text-xs"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-slate-500">
                    Totale cliente (€)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={newOption.total_price}
                    onChange={(e) =>
                      setNewOption((prev) => ({
                        ...prev,
                        total_price: e.target.value,
                      }))
                    }
                    className="w-full rounded-lg border border-slate-200 px-2 py-1 text-xs"
                  />
                </div>
              </div>

              <div className="grid gap-2 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-slate-500">
                    Costo interno (€)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={newOption.internal_cost}
                    onChange={(e) =>
                      setNewOption((prev) => ({
                        ...prev,
                        internal_cost: e.target.value,
                      }))
                    }
                    className="w-full rounded-lg border border-slate-200 px-2 py-1 text-xs"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-slate-500">
                    Margine (€)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={newOption.internal_profit}
                    onChange={(e) =>
                      setNewOption((prev) => ({
                        ...prev,
                        internal_profit: e.target.value,
                      }))
                    }
                    className="w-full rounded-lg border border-slate-200 px-2 py-1 text-xs"
                  />
                </div>
              </div>

              <div className="grid gap-2 sm:grid-cols-2">
                <label className="inline-flex cursor-pointer items-center gap-2 text-[11px] text-slate-600">
                  <input
                    type="checkbox"
                    checked={newOption.show_vat}
                    onChange={(e) =>
                      setNewOption((prev) => ({
                        ...prev,
                        show_vat: e.target.checked,
                      }))
                    }
                    className="h-3 w-3 rounded border-slate-300 text-slate-900 focus:ring-slate-500"
                  />
                  <span>Mostra prezzi IVA inclusa al cliente</span>
                </label>

                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-slate-500">
                    Aliquota IVA (%)
                  </span>
                  <input
                    type="number"
                    min={0}
                    max={99}
                    step={0.1}
                    value={newOption.vat_rate}
                    onChange={(e) =>
                      setNewOption((prev) => ({
                        ...prev,
                        vat_rate: e.target.value,
                      }))
                    }
                    className="w-16 rounded-lg border border-slate-200 px-2 py-1 text-[11px] text-slate-900 focus:border-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-300"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-slate-500">
                  Note pubbliche (visibili al cliente)
                </label>
                <textarea
                  rows={3}
                  value={newOption.public_notes}
                  onChange={(e) =>
                    setNewOption((prev) => ({
                      ...prev,
                      public_notes: e.target.value,
                    }))
                  }
                  className="w-full rounded-lg border border-slate-200 px-2 py-1 text-xs text-slate-900 focus:border-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-300"
                />
              </div>

              <div className="flex items-center justify-between pt-1">
                <label className="inline-flex cursor-pointer items-center gap-2 text-[11px] text-slate-600">
                  <input
                    type="checkbox"
                    checked={newOption.visible_to_client}
                    onChange={(e) =>
                      setNewOption((prev) => ({
                        ...prev,
                        visible_to_client: e.target.checked,
                      }))
                    }
                    className="h-3 w-3 rounded border-slate-300 text-slate-900 focus:ring-slate-500"
                  />
                  <span>Visibile al cliente</span>
                </label>

                <button
                  type="submit"
                  disabled={savingOption}
                  className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-3 py-1.5 text-[11px] font-medium text-white hover:bg-slate-800 disabled:opacity-60"
                >
                  {savingOption && (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  )}
                  <span>Salva come bozza</span>
                </button>
              </div>
            </form>
          </div>

          {/* TODO: qui potremo aggiungere "Invia email al cliente" con Resend */}
          <div className="rounded-2xl border border-dashed bg-slate-50/60 p-3 text-[11px] text-slate-500">
            In un secondo step qui colleghiamo il bottone per{" "}
            <span className="font-medium">
              inviare la quotazione via email (Resend)
            </span>{" "}
            usando le opzioni visibili al cliente.
          </div>
        </div>
      </div>
    </div>
  );
}
