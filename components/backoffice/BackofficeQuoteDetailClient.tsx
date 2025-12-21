// components/backoffice/BackofficeQuoteDetailClient.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";

import type { QuoteDetail, QuoteOptionRow, ParsedColli, Props } from "./quote-detail/types";
import { StatusBadge } from "./quote-detail/ui";
import {
  QTY_KEYS,
  L_KEYS,
  W_KEYS,
  H_KEYS,
  PESO_KEYS,
  pickNumber,
  toNumInput,
  fmtNum,
} from "./quote-detail/utils";
import { LeftColumn } from "./quote-detail/sections/LeftColumn";
import { RightColumn } from "./quote-detail/sections/RightColumn";

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

  // invio mail (Resend)
  const [sendingEmail, setSendingEmail] = useState(false);
  const [emailMsg, setEmailMsg] = useState<string | null>(null);

  // stato base "nuova opzione"
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
    vat_rate: "22",
  });
  const [optionMsg, setOptionMsg] = useState<string | null>(null);

  // Toggle JSON completo per mittente/destinatario/colli
  const [showMittenteJson, setShowMittenteJson] = useState(false);
  const [showDestinatarioJson, setShowDestinatarioJson] = useState(false);
  const [showColliJson, setShowColliJson] = useState(false);

  // ✅ Auto-calc: Totale cliente = nolo + dogana, Margine = totale - costo interno
  useEffect(() => {
    const freight = toNumInput(newOption.freight_price) ?? 0;
    const customs = toNumInput(newOption.customs_price) ?? 0;
    const total = freight + customs;

    const currentTotal = toNumInput(newOption.total_price);
    const shouldSetTotal =
      currentTotal == null || Math.abs(currentTotal - total) > 0.009;

    const internalCost = toNumInput(newOption.internal_cost);
    const margin =
      internalCost == null ? null : Math.round((total - internalCost) * 100) / 100;

    const currentMargin = toNumInput(newOption.internal_profit);
    const shouldSetMargin =
      margin != null &&
      (currentMargin == null || Math.abs(currentMargin - margin) > 0.009);

    if (shouldSetTotal || shouldSetMargin) {
      setNewOption((prev) => ({
        ...prev,
        total_price: shouldSetTotal ? fmtNum(total) : prev.total_price,
        internal_profit:
          margin == null
            ? prev.internal_profit
            : shouldSetMargin
            ? fmtNum(margin)
            : prev.internal_profit,
      }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [newOption.freight_price, newOption.customs_price, newOption.internal_cost]);

  const publicUrl = useMemo(() => {
    if (!quote?.public_token) return null;
    return `https://spst-operations.vercel.app/quote/${quote.public_token}`;
  }, [quote?.public_token]);

  // ------- Load quote + options ---------------------------------------------------
  useEffect(() => {
    let active = true;

    async function load() {
      setLoading(true);
      setError(null);

      try {
        const res = await fetch(`/api/quote-requests/${id}`, { cache: "no-store" });
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

  async function handleDeleteOption(optionId: string) {
    if (!optionId) return;

    if (
      !window.confirm(
        "Vuoi eliminare definitivamente questa opzione di quotazione in bozza?"
      )
    ) {
      return;
    }

    setOptionMsg(null);
    setLoadingOptions(true);

    try {
      const res = await fetch(`/api/quote-options/${optionId}`, {
        method: "DELETE",
      });
      const json = await res.json().catch(() => ({}));

      if (!res.ok || !json?.ok) {
        throw new Error(json?.error || `HTTP ${res.status}`);
      }

      setOptions((prev) => prev.filter((opt) => opt.id !== optionId));
    } catch (e: any) {
      console.error("Errore durante eliminazione opzione:", e);
      setOptionMsg(
        e?.message || "Errore durante l'eliminazione dell'opzione di quotazione."
      );
    } finally {
      setLoadingOptions(false);
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
        freight_price: newOption.freight_price ? Number(newOption.freight_price) : null,
        customs_price: newOption.customs_price ? Number(newOption.customs_price) : null,
        total_price: newOption.total_price ? Number(newOption.total_price) : null,
        currency: newOption.currency || "EUR",
        public_notes: newOption.public_notes || null,
        internal_cost: newOption.internal_cost ? Number(newOption.internal_cost) : null,
        internal_profit: newOption.internal_profit ? Number(newOption.internal_profit) : null,
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

      setOptions((prev) => [...prev, json.option as QuoteOptionRow]);
      setOptionMsg("Opzione salvata come bozza.");
    } catch (e: any) {
      console.error("[BackofficeQuoteDetail] save option error:", e);
      setOptionMsg("Errore nel salvataggio dell'opzione.");
    } finally {
      setSavingOption(false);
    }
  }

  // ✅ Bottone invio mail (tenuto lontano dal link pubblico)
  async function handleSendPublicLinkEmail() {
    if (!quote) return;

    setEmailMsg(null);

    // sicurezza: chiedi conferma esplicita
    const ok = window.confirm(
      "Confermi INVIO EMAIL al cliente con link quotazione?\n\n(Per sicurezza: verifica che il link pubblico sia corretto e che le opzioni visibili al cliente siano pronte.)"
    );
    if (!ok) return;

    setSendingEmail(true);
    try {
      const res = await fetch(`/api/quote-requests/${id}/send-public-link`, {
        method: "POST",
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.ok) {
        throw new Error(json?.error || `HTTP ${res.status}`);
      }

      setEmailMsg(`Email inviata a ${json.to || "cliente"}.`);
      // ricarico quote per aggiornare status/fields
      const q = await fetch(`/api/quote-requests/${id}`, { cache: "no-store" });
      const qj = await q.json().catch(() => ({}));
      if (q.ok && qj?.ok && qj.quote) setQuote(qj.quote as QuoteDetail);
    } catch (e: any) {
      console.error("[BackofficeQuoteDetail] send mail error:", e);
      setEmailMsg(e?.message || "Errore durante l'invio della mail.");
    } finally {
      setSendingEmail(false);
    }
  }

  // ------- Derived ---------------------------------------------------------------
  const derivedHeaderStatus = useMemo(() => {
    if (!quote) return "—";
    const qStatus = (quote.status || "").toLowerCase();

    // ✅ se DB ha accepted_option_id o se esiste un'opzione accettata → header deve mostrare "accettata"
    const anyAcceptedOption = options.some((o) =>
      String(o.status || "").toLowerCase().includes("accett")
    );
    const accepted = Boolean(quote.accepted_option_id) || anyAcceptedOption;

    if (accepted) return "accettata";
    if (qStatus) return quote.status || "—";
    return "—";
  }, [quote, options]);

  const baseInfo = useMemo(() => {
    if (!quote) return null;
    return {
      id: quote.id,
      human: quote.human_id || quote.id,
      stato: derivedHeaderStatus,
      created_at: quote.created_at,
      data_ritiro: quote.data_ritiro,
      tipo_spedizione: quote.tipo_spedizione || "—",
      incoterm: quote.incoterm || "—",
      valuta: quote.valuta || "EUR",
    };
  }, [quote, derivedHeaderStatus]);

  // colli: array normalizzato + totals
  const parsedColli: ParsedColli = useMemo(() => {
    if (!quote) return { rows: [], totalQty: 0, totalWeight: 0 };

    const raw =
      (Array.isArray(quote.colli) && quote.colli) ||
      (Array.isArray(quote.fields?.colli) && quote.fields.colli) ||
      [];

    const rows: ParsedColli["rows"] = [];
    let totalQty = 0;
    let totalWeight = 0;

    (raw as any[]).forEach((c, idx) => {
      const cf = c || {};
      const qty = pickNumber(cf, QTY_KEYS) ?? 1;
      const L = pickNumber(cf, L_KEYS);
      const W = pickNumber(cf, W_KEYS);
      const H = pickNumber(cf, H_KEYS);
      const peso = pickNumber(cf, PESO_KEYS) ?? undefined;

      const dimsParts = [L, W, H].map((n) => (n != null ? String(n) : "—"));
      const dims =
        L == null && W == null && H == null
          ? "—"
          : `${dimsParts[0]} × ${dimsParts[1]} × ${dimsParts[2]}`;

      rows.push({
        i: idx + 1,
        qty,
        dims,
        peso: peso ?? "—",
      });

      totalQty += qty || 0;
      if (peso != null) totalWeight += (peso || 0) * (qty || 1);
    });

    return { rows, totalQty, totalWeight };
  }, [quote]);

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

  const colliLabel =
    parsedColli.totalQty === 1
      ? "1 collo"
      : `${parsedColli.totalQty || parsedColli.rows.length} colli`;

  const pesoTotaleLabel =
    parsedColli.totalWeight > 0
      ? `${parsedColli.totalWeight.toLocaleString("it-IT", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })} kg`
      : "—";

  // contenuto colli: colonna canonica + fallback
  const contenutoColli =
    (quote as any).contenuto_colli ??
    quote.contenuto_colli ??
    quote.fields?.contenuto_colli ??
    quote.fields?.contenutoColli ??
    quote.fields?.contenuto_colli ??
    "";

  // ✅ Assicurazione (da declared_value + fallback su fields)
  const insuranceValue =
    quote.declared_value ??
    (quote.fields?.valoreAssicurato != null
      ? Number(quote.fields.valoreAssicurato)
      : null);

  const insuranceActive =
    (insuranceValue != null && Number.isFinite(insuranceValue) && insuranceValue > 0) ||
    quote.fields?.assicurazioneAttiva === true;

    // ✅ Formato spedizione: Pallet vs Pacco (da fields)
  const formatoRaw =
    quote.fields?.formato ??
    quote.fields?.formato_spedizione ??
    quote.fields?.shipping_method ??
    quote.fields?.formatoSpedizione ??
    null;

  const formatoNorm = (() => {
    const s = String(formatoRaw ?? "").trim().toLowerCase();
    if (!s) return null;
    if (s.includes("pallet")) return "Pallet";
    if (s.includes("pacco")) return "Pacco";
    // se per caso arriva "COLLO" o simili
    if (s.includes("collo") || s.includes("box") || s.includes("parcel")) return "Pacco";
    return String(formatoRaw);
  })();


  // opzioni visibili al cliente (per mail) — NO HOOK (evita crash hooks-order)
  const visibleOptionsCount = options.filter((o) => o.visible_to_client !== false).length;

  const canSendEmail =
    Boolean(publicUrl) && Boolean(quote?.email_cliente) && visibleOptionsCount > 0;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-base font-semibold text-slate-900">{baseInfo.human}</h1>
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
        {/* Colonna sinistra */}
        <LeftColumn
          quote={quote}
          baseInfo={baseInfo}
          derivedHeaderStatus={derivedHeaderStatus}
          showMittenteJson={showMittenteJson}
          setShowMittenteJson={setShowMittenteJson}
          showDestinatarioJson={showDestinatarioJson}
          setShowDestinatarioJson={setShowDestinatarioJson}
          showColliJson={showColliJson}
          setShowColliJson={setShowColliJson}
          parsedColli={parsedColli}
          colliLabel={colliLabel}
          pesoTotaleLabel={pesoTotaleLabel}
          contenutoColli={contenutoColli}
          insuranceActive={insuranceActive}
          insuranceValue={insuranceValue}
          formato={formatoNorm} 
        />

        {/* Colonna destra */}
        <RightColumn
          id={id}
          quote={quote}
          options={options}
          loadingOptions={loadingOptions}
          linkMsg={linkMsg}
          creatingLink={creatingLink}
          publicUrl={publicUrl}
          copied={copied}
          handleCreatePublicLink={handleCreatePublicLink}
          handleCopyLink={handleCopyLink}
          handleDeleteOption={handleDeleteOption}
          optionMsg={optionMsg}
          savingOption={savingOption}
          newOption={newOption}
          setNewOption={setNewOption}
          handleSaveNewOption={handleSaveNewOption}
          visibleOptionsCount={visibleOptionsCount}
          canSendEmail={canSendEmail}
          sendingEmail={sendingEmail}
          emailMsg={emailMsg}
          handleSendPublicLinkEmail={handleSendPublicLinkEmail}
        />
      </div>
    </div>
  );
}
