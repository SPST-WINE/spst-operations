// components/backoffice/BackofficeQuotazioniClient.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Search, ExternalLink } from "lucide-react";

type TabKey = "received" | "sent";

type QuoteReceivedRow = {
  id: string;
  human_id: string | null;
  created_at: string | null;
  email_cliente: string | null;
  tipo_spedizione: string | null;
  incoterm: string | null;
  status: string | null;
};

type QuoteSentRow = {
  id: string; // id opzione
  quote_id: string;
  label: string | null;
  carrier: string | null;
  service_name: string | null;
  total_price: number | null;
  currency: string | null;
  internal_cost: number | null;
  internal_profit: number | null;
  status: string | null;
  sent_at: string | null;
};

function norm(s?: string | null) {
  return (s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
}

function formatDate(dateStr?: string | null) {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("it-IT", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
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

export default function BackofficeQuotazioniClient() {
  const [tab, setTab] = useState<TabKey>("received");

  const [rowsReceived, setRowsReceived] = useState<QuoteReceivedRow[]>([]);
  const [loadingReceived, setLoadingReceived] = useState(true);
  const [qReceived, setQReceived] = useState("");

  const [rowsSent, setRowsSent] = useState<QuoteSentRow[]>([]);
  const [loadingSent, setLoadingSent] = useState(false);
  const [loadedSentOnce, setLoadedSentOnce] = useState(false);
  const [qSent, setQSent] = useState("");

  // --------- Load "Quotazioni ricevute" -----------------------------------

  useEffect(() => {
    let active = true;

    async function load() {
      setLoadingReceived(true);
      try {
        const res = await fetch("/api/quote-requests", {
          cache: "no-store",
        });
        const data = await res.json().catch(() => ({} as any));

        if (!active) return;

        if (data?.ok && Array.isArray(data.rows)) {
          setRowsReceived(data.rows as QuoteReceivedRow[]);
        } else {
          setRowsReceived([]);
        }
      } catch (e) {
        console.error("[BackofficeQuotazioniClient] load received error:", e);
        if (active) setRowsReceived([]);
      } finally {
        if (active) setLoadingReceived(false);
      }
    }

    load();

    return () => {
      active = false;
    };
  }, []);

  // --------- Load "Quotazioni inviate" (on demand) -----------------------

  useEffect(() => {
    if (tab !== "sent") return;
    if (loadedSentOnce) return;

    let active = true;

    async function loadSent() {
      setLoadingSent(true);
      try {
        const res = await fetch("/api/quote-options?scope=sent", {
          cache: "no-store",
        });
        const data = await res.json().catch(() => ({} as any));

        if (!active) return;

        if (data?.ok && Array.isArray(data.rows)) {
          setRowsSent(data.rows as QuoteSentRow[]);
        } else {
          setRowsSent([]);
        }
      } catch (e) {
        console.error("[BackofficeQuotazioniClient] load sent error:", e);
        if (active) setRowsSent([]);
      } finally {
        if (active) {
          setLoadingSent(false);
          setLoadedSentOnce(true);
        }
      }
    }

    loadSent();

    return () => {
      active = false;
    };
  }, [tab, loadedSentOnce]);

  // --------- Filtri ------------------------------------------------------

  const filteredReceived = useMemo(() => {
    const nq = norm(qReceived);
    if (!nq) return rowsReceived;

    return rowsReceived.filter((r) => {
      const haystack =
        norm(r.human_id) +
        " " +
        norm(r.email_cliente) +
        " " +
        norm(r.tipo_spedizione) +
        " " +
        norm(r.incoterm) +
        " " +
        norm(r.status);
      return haystack.includes(nq);
    });
  }, [rowsReceived, qReceived]);

  const filteredSent = useMemo(() => {
    const nq = norm(qSent);
    if (!nq) return rowsSent;

    return rowsSent.filter((r) => {
      const haystack =
        norm(r.label) +
        " " +
        norm(r.carrier) +
        " " +
        norm(r.service_name) +
        " " +
        norm(r.status);
      return haystack.includes(nq);
    });
  }, [rowsSent, qSent]);

  // --------- Render helpers ---------------------------------------------

  function renderTabSwitcher() {
    return (
      <div className="inline-flex items-center rounded-full bg-slate-100 p-1 text-xs">
        <button
          type="button"
          onClick={() => setTab("received")}
          className={`px-3 py-1.5 rounded-full transition ${
            tab === "received"
              ? "bg-white text-slate-900 shadow-sm"
              : "text-slate-500 hover:text-slate-800"
          }`}
        >
          Quotazioni ricevute
        </button>
        <button
          type="button"
          onClick={() => setTab("sent")}
          className={`px-3 py-1.5 rounded-full transition ${
            tab === "sent"
              ? "bg-white text-slate-900 shadow-sm"
              : "text-slate-500 hover:text-slate-800"
          }`}
        >
          Quotazioni inviate
        </button>
      </div>
    );
  }

  function renderReceived() {
    return (
      <div className="rounded-2xl border bg-white p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <span className="text-xs font-medium text-slate-700">
              Quotazioni ricevute
            </span>
            <span className="h-1 w-1 rounded-full bg-slate-300" />
            <span className="text-xs text-slate-500">
              {filteredReceived.length} su {rowsReceived.length} richieste
            </span>
          </div>

          <div className="relative flex items-center">
            <Search className="pointer-events-none absolute left-2 h-4 w-4 text-slate-400" />
            <input
              type="search"
              placeholder="Cerca per ID, email, tipo spedizione, incoterm..."
              value={qReceived}
              onChange={(e) => setQReceived(e.target.value)}
              className="h-9 w-full rounded-lg border border-slate-200 bg-white pl-8 pr-3 text-xs text-slate-900 placeholder:text-slate-400 focus:border-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-300 sm:w-80"
            />
          </div>
        </div>

        <div className="mt-4 divide-y border-t border-slate-100">
          {loadingReceived ? (
            <div className="py-6 text-center text-xs text-slate-500">
              Carico le richieste di quotazione...
            </div>
          ) : filteredReceived.length === 0 ? (
            <div className="py-6 text-center text-xs text-slate-500">
              Nessuna richiesta di quotazione trovata.
            </div>
          ) : (
            filteredReceived.map((r) => (
              <div
                key={r.id}
                className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-slate-900">
                      {r.human_id || r.id}
                    </span>
                    <StatusBadge value={r.status} />
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-600">
                    <span className="truncate max-w-xs">
                      {r.email_cliente || "—"}
                    </span>
                    <span className="h-1 w-1 rounded-full bg-slate-300" />
                    <span>
                      Tipo: {r.tipo_spedizione || "—"} · Incoterm:{" "}
                      {r.incoterm || "—"}
                    </span>
                    <span className="h-1 w-1 rounded-full bg-slate-300" />
                    <span>Creata: {formatDate(r.created_at)}</span>
                  </div>
                </div>

                <div className="flex flex-col items-start gap-1 text-xs sm:items-end">
                  <Link
                    href={`/back-office/quotazioni/${r.id}`}
                    className="inline-flex items-center gap-1 rounded-full border border-slate-200 px-3 py-1 text-[11px] font-medium text-slate-700 hover:border-slate-300 hover:bg-slate-50"
                  >
                    <span>Apri dettaglio</span>
                    <ExternalLink className="h-3 w-3" />
                  </Link>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    );
  }

  function renderSent() {
    return (
      <div className="rounded-2xl border bg-white p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <span className="text-xs font-medium text-slate-700">
              Quotazioni inviate al cliente
            </span>
            <span className="h-1 w-1 rounded-full bg-slate-300" />
            <span className="text-xs text-slate-500">
              {filteredSent.length} opzioni su {rowsSent.length}
            </span>
          </div>

          <div className="relative flex items-center">
            <Search className="pointer-events-none absolute left-2 h-4 w-4 text-slate-400" />
            <input
              type="search"
              placeholder="Cerca per carrier, servizio, stato..."
              value={qSent}
              onChange={(e) => setQSent(e.target.value)}
              className="h-9 w-full rounded-lg border border-slate-200 bg-white pl-8 pr-3 text-xs text-slate-900 placeholder:text-slate-400 focus:border-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-300 sm:w-80"
            />
          </div>
        </div>

        <div className="mt-4 divide-y border-t border-slate-100">
          {loadingSent ? (
            <div className="py-6 text-center text-xs text-slate-500">
              Carico le quotazioni inviate...
            </div>
          ) : filteredSent.length === 0 ? (
            <div className="py-6 text-center text-xs text-slate-500">
              Nessuna opzione inviata trovata.
            </div>
          ) : (
            filteredSent.map((r) => {
              const margin =
                r.internal_profit != null
                  ? r.internal_profit
                  : r.internal_cost != null && r.total_price != null
                  ? r.total_price - r.internal_cost
                  : null;

              return (
                <div
                  key={r.id}
                  className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium text-slate-900">
                        {r.label || "Opzione"}
                      </span>
                      <StatusBadge value={r.status} />
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-600">
                      <span>
                        {r.carrier || "—"} · {r.service_name || "—"}
                      </span>
                      <span className="h-1 w-1 rounded-full bg-slate-300" />
                      <span>
                        Totale cliente:{" "}
                        {formatCurrency(r.total_price || 0, r.currency)}
                      </span>
                      {r.internal_cost != null && (
                        <>
                          <span className="h-1 w-1 rounded-full bg-slate-300" />
                          <span>
                            Costo interno:{" "}
                            {formatCurrency(r.internal_cost, r.currency)}
                          </span>
                        </>
                      )}
                      {margin != null && (
                        <>
                          <span className="h-1 w-1 rounded-full bg-slate-300" />
                          <span>Margine: {formatCurrency(margin, r.currency)}</span>
                        </>
                      )}
                      <span className="h-1 w-1 rounded-full bg-slate-300" />
                      <span>Inviata: {formatDate(r.sent_at)}</span>
                    </div>
                  </div>

                  <div className="flex flex-col items-start gap-1 text-xs sm:items-end">
                    <Link
                      href={`/back-office/quotazioni/${r.quote_id}`}
                      className="inline-flex items-center gap-1 rounded-full border border-slate-200 px-3 py-1 text-[11px] font-medium text-slate-700 hover:border-slate-300 hover:bg-slate-50"
                    >
                      <span>Apri richiesta</span>
                      <ExternalLink className="h-3 w-3" />
                    </Link>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        {renderTabSwitcher()}
      </div>

      {tab === "received" ? renderReceived() : renderSent()}
    </div>
  );
}
