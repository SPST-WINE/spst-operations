// components/backoffice/quote-detail/sections/LeftColumn.tsx
"use client";

import React from "react";
import { InfoRow } from "../ui";
import { formatCurrency, formatDate, formatDateTime } from "../utils";
import type { ParsedColli, QuoteDetail } from "../types";

export function LeftColumn({
  quote,
  baseInfo,
  derivedHeaderStatus, // non usato qui ma tenuto per compatibilità futura
  showMittenteJson,
  setShowMittenteJson,
  showDestinatarioJson,
  setShowDestinatarioJson,
  showColliJson,
  setShowColliJson,
  parsedColli,
  colliLabel,
  pesoTotaleLabel,
  contenutoColli,
  insuranceActive,
  insuranceValue,
}: {
  quote: QuoteDetail;
  baseInfo: {
    id: string;
    human: string;
    stato: string;
    created_at: string | null;
    data_ritiro: string | null;
    tipo_spedizione: string;
    incoterm: string;
    valuta: string;
  };
  derivedHeaderStatus: string;
  showMittenteJson: boolean;
  setShowMittenteJson: React.Dispatch<React.SetStateAction<boolean>>;
  showDestinatarioJson: boolean;
  setShowDestinatarioJson: React.Dispatch<React.SetStateAction<boolean>>;
  showColliJson: boolean;
  setShowColliJson: React.Dispatch<React.SetStateAction<boolean>>;
  parsedColli: ParsedColli;
  colliLabel: string;
  pesoTotaleLabel: string;
  contenutoColli: string;
  insuranceActive: boolean;
  insuranceValue: number | null;
}) {
  return (
    <div className="space-y-4">
      {/* Dati generali */}
      <div className="rounded-2xl border bg-white p-4">
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-600">
            Dati generali
          </h2>
          <p className="mt-0.5 text-[11px] text-slate-500">
            Informazioni principali sulla richiesta di quotazione.
          </p>
        </div>

        <div className="mt-3 space-y-2">
          <InfoRow label="Creata il" value={formatDateTime(baseInfo.created_at)} />
          <InfoRow label="Data ritiro" value={formatDate(baseInfo.data_ritiro)} />
          <InfoRow label="Tipo spedizione" value={quote.tipo_spedizione || "—"} />
          <InfoRow label="Incoterm" value={quote.incoterm || "—"} />
          <InfoRow label="Valuta" value={quote.valuta || "EUR"} />
          <InfoRow label="Assicurazione" value={insuranceActive ? "Attiva" : "No"} />
          <InfoRow
            label="Valore assicurato"
            value={
              insuranceActive && insuranceValue != null
                ? formatCurrency(insuranceValue, quote.valuta || "EUR")
                : "—"
            }
          />
          <InfoRow label="Email cliente" value={quote.email_cliente || "—"} />
          <InfoRow label="Origine" value={quote.origin || "dashboard"} />
        </div>

        {quote.note_generiche && (
          <div className="mt-3 rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-700">
            <div className="mb-1 text-[11px] font-medium text-slate-500">
              Note generali
            </div>
            <div className="whitespace-pre-wrap">{quote.note_generiche}</div>
          </div>
        )}
      </div>

      {/* Mittente / Destinatario con toggle JSON */}
      <div className="rounded-2xl border bg-white p-4">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-600">
          Mittente &amp; Destinatario
        </h2>

        <div className="mt-3 grid gap-3 md:grid-cols-2">
          {/* MITTENTE */}
          <div className="rounded-xl border bg-white p-4 shadow-sm">
            <div className="mb-2 text-sm font-semibold">MITTENTE</div>

            <div className="text-sm font-medium">
              {quote?.mittente?.ragioneSociale ||
                quote?.fields?.mittente?.ragioneSociale ||
                "—"}
            </div>
            <div className="text-sm text-slate-600">
              {[
                quote?.mittente?.indirizzo ?? quote?.fields?.mittente?.indirizzo,
                quote?.mittente?.cap ?? quote?.fields?.mittente?.cap,
                quote?.mittente?.citta ?? quote?.fields?.mittente?.citta,
                quote?.mittente?.paese ?? quote?.fields?.mittente?.paese,
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
                  2
                )}
              </pre>
            )}
          </div>

          {/* DESTINATARIO */}
          <div className="rounded-xl border bg-white p-4 shadow-sm">
            <div className="mb-2 text-sm font-semibold">DESTINATARIO</div>

            <div className="text-sm font-medium">
              {quote?.destinatario?.ragioneSociale ||
                quote?.fields?.destinatario?.ragioneSociale ||
                "—"}
            </div>
            <div className="text-sm text-slate-600">
              {[
                quote?.destinatario?.indirizzo ??
                  quote?.fields?.destinatario?.indirizzo,
                quote?.destinatario?.cap ?? quote?.fields?.destinatario?.cap,
                quote?.destinatario?.citta ?? quote?.fields?.destinatario?.citta,
                quote?.destinatario?.paese ?? quote?.fields?.destinatario?.paese,
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
                  2
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

          {(quote?.colli || quote?.fields?.colli || quote?.fields?.colli_debug) && (
            <button
              type="button"
              onClick={() => setShowColliJson((v) => !v)}
              className="text-[11px] font-normal text-slate-500 underline-offset-2 hover:underline"
            >
              {showColliJson ? "Nascondi JSON completo" : "Vedi JSON completo (debug)"}
            </button>
          )}
        </div>

        {/* Contenuto colli */}
        {contenutoColli && (
          <div className="mb-3 text-xs text-slate-700">
            <div className="text-[11px] font-medium text-slate-500">
              Contenuto colli
            </div>
            <div className="mt-0.5 whitespace-pre-wrap">{contenutoColli}</div>
          </div>
        )}

        {/* Tabella colli */}
        {parsedColli.rows.length === 0 ? (
          <p className="mt-2 text-xs text-slate-500">
            I dettagli dei colli sono presenti nel JSON originale della richiesta.
          </p>
        ) : (
          <div className="mt-2 rounded-xl bg-slate-50 p-3 text-xs text-slate-800">
            <div className="mb-2 flex items-center justify-between text-[11px] text-slate-600">
              <span>{colliLabel}</span>
              <span>Peso totale {pesoTotaleLabel}</span>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-[420px] w-full text-xs">
                <thead className="text-left text-slate-500">
                  <tr>
                    <th className="pb-1 pr-4">#</th>
                    <th className="pb-1 pr-4">Qtà</th>
                    <th className="pb-1 pr-4">Dimensioni (cm)</th>
                    <th className="pb-1 pr-2">Peso (kg)</th>
                  </tr>
                </thead>
                <tbody className="align-top">
                  {parsedColli.rows.map((c) => (
                    <tr key={c.i} className="border-t border-slate-100">
                      <td className="py-1.5 pr-4">{c.i}</td>
                      <td className="py-1.5 pr-4">{c.qty}</td>
                      <td className="py-1.5 pr-4">{c.dims}</td>
                      <td className="py-1.5 pr-2">
                        {typeof c.peso === "number"
                          ? c.peso.toLocaleString("it-IT", {
                              maximumFractionDigits: 2,
                              minimumFractionDigits: 0,
                            })
                          : c.peso}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {showColliJson && (
          <pre className="mt-3 max-h-72 overflow-auto rounded-lg bg-slate-900 p-3 text-[11px] text-slate-100">
            {JSON.stringify(
              quote?.colli ??
                quote?.fields?.colli ??
                quote?.fields?.colli_debug ??
                [],
              null,
              2
            )}
          </pre>
        )}
      </div>
    </div>
  );
}
