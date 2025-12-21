// components/backoffice/quote-detail/sections/RightColumn.tsx
"use client";

import React from "react";
import Link from "next/link";
import { Loader2, Globe2, Copy, Check, Mail, ShieldAlert } from "lucide-react";
import { StatusBadge } from "../ui";
import { formatCurrency, formatDateTime } from "../utils";
import type { QuoteDetail, QuoteOptionRow } from "../types";

export function RightColumn({
  id,
  quote,
  options,
  loadingOptions,
  linkMsg,
  creatingLink,
  publicUrl,
  copied,
  handleCreatePublicLink,
  handleCopyLink,
  handleDeleteOption,
  // form nuova opzione
  optionMsg,
  savingOption,
  newOption,
  setNewOption,
  handleSaveNewOption,
  // invio email
  visibleOptionsCount,
  canSendEmail,
  sendingEmail,
  emailMsg,
  handleSendPublicLinkEmail,
}: {
  id: string;
  quote: QuoteDetail;
  options: QuoteOptionRow[];
  loadingOptions: boolean;

  creatingLink: boolean;
  linkMsg: string | null;
  publicUrl: string | null;
  copied: boolean;
  handleCreatePublicLink: () => Promise<void>;
  handleCopyLink: () => Promise<void>;
  handleDeleteOption: (optionId: string) => Promise<void>;

  optionMsg: string | null;
  savingOption: boolean;
  newOption: any;
  setNewOption: React.Dispatch<React.SetStateAction<any>>;
  handleSaveNewOption: (e: React.FormEvent) => Promise<void>;

  visibleOptionsCount: number;
  canSendEmail: boolean;
  sendingEmail: boolean;
  emailMsg: string | null;
  handleSendPublicLinkEmail: () => Promise<void>;
}) {
  return (
    <div className="space-y-4">
      {/* Link pubblico */}
      <div className="rounded-2xl border bg-white p-4">
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-600">
            Link pubblico quotazione
          </h2>
          <p className="mt-0.5 text-[11px] text-slate-500">
            Genera un link pubblico da condividere con il cliente per permettergli di
            scegliere l&apos;opzione preferita.
          </p>
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

          {linkMsg && <p className="text-[11px] text-slate-500">{linkMsg}</p>}

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
          <span className="text-[11px] text-slate-500">{options.length} opzioni</span>
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
                        Totale cliente: {formatCurrency(o.total_price || 0, o.currency)}
                      </span>

                      {o.internal_cost != null && (
                        <>
                          <span className="h-1 w-1 rounded-full bg-slate-300" />
                          <span>
                            Costo interno: {formatCurrency(o.internal_cost, o.currency)}
                          </span>
                        </>
                      )}

                      {margin != null && (
                        <>
                          <span className="h-1 w-1 rounded-full bg-slate-300" />
                          <span>Margine: {formatCurrency(margin, o.currency)}</span>
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

                  <div className="flex flex-col items-end gap-1 text-[11px]">
                    <span className="rounded-full bg-slate-50 px-2 py-0.5 text-slate-500">
                      ID opzione: {o.id.slice(0, 8)}…
                    </span>

                    {String(o.status || "").toLowerCase() === "bozza" && (
                      <button
                        type="button"
                        onClick={() => handleDeleteOption(o.id)}
                        className="rounded-lg border border-rose-200 bg-rose-50 px-2 py-1 text-[11px] font-medium text-rose-700 hover:bg-rose-100"
                      >
                        Elimina bozza
                      </button>
                    )}
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
          {optionMsg && <span className="text-[11px] text-slate-500">{optionMsg}</span>}
        </div>

        <form className="mt-3 space-y-3 text-[11px]" onSubmit={handleSaveNewOption}>
          <div className="grid gap-2 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-slate-500">Label</label>
              <input
                type="text"
                value={newOption.label}
                onChange={(e) =>
                  setNewOption((prev: any) => ({ ...prev, label: e.target.value }))
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
                  setNewOption((prev: any) => ({ ...prev, carrier: e.target.value }))
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
                  setNewOption((prev: any) => ({
                    ...prev,
                    service_name: e.target.value,
                  }))
                }
                className="w-full rounded-lg border border-slate-200 px-2 py-1 text-xs text-slate-900 focus:border-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-300"
              />
            </div>
            <div>
              <label className="mb-1 block text-slate-500">Transit time</label>
              <input
                type="text"
                value={newOption.transit_time}
                onChange={(e) =>
                  setNewOption((prev: any) => ({
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
                  setNewOption((prev: any) => ({
                    ...prev,
                    freight_price: e.target.value,
                  }))
                }
                className="w-full rounded-lg border border-slate-200 px-2 py-1 text-xs"
              />
            </div>
            <div>
              <label className="mb-1 block text-slate-500">Dogana (€)</label>
              <input
                type="number"
                step="0.01"
                value={newOption.customs_price}
                onChange={(e) =>
                  setNewOption((prev: any) => ({
                    ...prev,
                    customs_price: e.target.value,
                  }))
                }
                className="w-full rounded-lg border border-slate-200 px-2 py-1 text-xs"
              />
            </div>
            <div>
              <label className="mb-1 block text-slate-500">Totale cliente (€)</label>
              <input
                type="number"
                step="0.01"
                value={newOption.total_price}
                onChange={(e) =>
                  setNewOption((prev: any) => ({
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
              <label className="mb-1 block text-slate-500">Costo interno (€)</label>
              <input
                type="number"
                step="0.01"
                value={newOption.internal_cost}
                onChange={(e) =>
                  setNewOption((prev: any) => ({
                    ...prev,
                    internal_cost: e.target.value,
                  }))
                }
                className="w-full rounded-lg border border-slate-200 px-2 py-1 text-xs"
              />
            </div>
            <div>
              <label className="mb-1 block text-slate-500">Margine (€)</label>
              <input
                type="number"
                step="0.01"
                value={newOption.internal_profit}
                onChange={(e) =>
                  setNewOption((prev: any) => ({
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
                  setNewOption((prev: any) => ({
                    ...prev,
                    show_vat: e.target.checked,
                  }))
                }
                className="h-3 w-3 rounded border-slate-300 text-slate-900 focus:ring-slate-500"
              />
              <span>Mostra prezzi IVA inclusa al cliente</span>
            </label>

            <div className="flex items-center gap-2">
              <span className="text-[11px] text-slate-500">Aliquota IVA (%)</span>
              <input
                type="number"
                min={0}
                max={99}
                step={0.1}
                value={newOption.vat_rate}
                onChange={(e) =>
                  setNewOption((prev: any) => ({
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
                setNewOption((prev: any) => ({
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
                  setNewOption((prev: any) => ({
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
              {savingOption && <Loader2 className="h-3 w-3 animate-spin" />}
              <span>Salva come bozza</span>
            </button>
          </div>
        </form>
      </div>

      {/* ✅ INVIO EMAIL */}
      <div className="rounded-2xl border border-dashed bg-slate-50/60 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-700">
              Invio email al cliente
            </div>
            <p className="mt-1 text-[11px] text-slate-600">
              Bottone “sensibile” tenuto separato dal link pubblico per sicurezza.
            </p>
          </div>
          <ShieldAlert className="h-4 w-4 text-slate-500" />
        </div>

        <div className="mt-3 space-y-2">
          <div className="text-[11px] text-slate-600">
            <div>
              <span className="text-slate-500">Email cliente:</span>{" "}
              <span className="font-medium text-slate-800">
                {quote.email_cliente || "—"}
              </span>
            </div>
            <div className="mt-0.5">
              <span className="text-slate-500">Link pubblico:</span>{" "}
              <span className="font-medium text-slate-800">
                {publicUrl ? "OK" : "mancante"}
              </span>
            </div>
            <div className="mt-0.5">
              <span className="text-slate-500">Opzioni visibili al cliente:</span>{" "}
              <span className="font-medium text-slate-800">{visibleOptionsCount}</span>
            </div>
          </div>

          <button
            type="button"
            onClick={handleSendPublicLinkEmail}
            disabled={sendingEmail || !canSendEmail}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-3 py-2 text-[12px] font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
            title={
              canSendEmail
                ? "Invia email al cliente"
                : "Serve: email cliente + link pubblico + almeno 1 opzione visibile"
            }
          >
            {sendingEmail ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Mail className="h-4 w-4" />
            )}
            <span>Invia quotazione via email (Resend)</span>
          </button>

          {emailMsg && <p className="text-[11px] text-slate-600">{emailMsg}</p>}

          {!canSendEmail && (
            <p className="text-[11px] text-slate-500">
              Per inviare: genera prima il link pubblico e assicurati che esista almeno
              un’opzione visibile al cliente.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
