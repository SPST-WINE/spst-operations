// app/back-office/nuova-spedizione/page.tsx
"use client";

import { useState } from "react";
import { Mail, Search, UserCircle2, MapPin, Phone, Wine, Boxes } from "lucide-react";
import Link from "next/link";

export const dynamic = "force-dynamic";

type ImposFields = {
  ["Mittente"]?: string;
  ["Paese Mittente"]?: string;
  ["Città Mittente"]?: string;
  ["CAP Mittente"]?: string;
  ["Indirizzo Mittente"]?: string;
  ["Partita IVA Mittente"]?: string;
  ["Telefono Mittente"]?: string;
};

export default function BackofficeNuovaSpedizionePage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<ImposFields | null>(null);

  async function handleLoadCliente() {
    setError(null);
    setFields(null);

    const trimmed = email.trim().toLowerCase();
    if (!trimmed) {
      setError("Inserisci una mail cliente valida.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(
        `/api/impostazioni?email=${encodeURIComponent(trimmed)}`,
        {
          headers: {
            "x-spst-email": trimmed,
          },
        }
      );

      if (!res.ok) {
        setError("Impossibile caricare le impostazioni per questa mail.");
        return;
      }

      const json = await res.json().catch(() => ({} as any));
      const recordFields: ImposFields | null =
        (json?.record?.fields as ImposFields) || null;

      setFields(recordFields);
    } catch (e) {
      console.error(e);
      setError("Errore di rete nel caricamento delle impostazioni.");
    } finally {
      setLoading(false);
    }
  }

  const hasCliente = !!fields;

  const vinoHref =
    email.trim() !== ""
      ? `/dashboard/nuova/vino?for=${encodeURIComponent(email.trim().toLowerCase())}`
      : undefined;
  const altroHref =
    email.trim() !== ""
      ? `/dashboard/nuova/altro?for=${encodeURIComponent(email.trim().toLowerCase())}`
      : undefined;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-800">
          Crea spedizione per un cliente
        </h1>
        <p className="text-sm text-slate-600 max-w-2xl">
          Da qui puoi creare una nuova spedizione per conto di qualsiasi cliente
          SPST, utilizzando gli stessi form dell&apos;area riservata ma scegliendo
          tu la mail del cliente.
        </p>
      </div>

      {/* Selezione mail cliente */}
      <div className="rounded-2xl border bg-white p-4 shadow-sm">
        <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-slate-400 mb-3">
          <Mail className="h-3 w-3" />
          <span>Seleziona cliente</span>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="flex-1">
            <label className="mb-1 block text-xs font-medium text-slate-600">
              Mail cliente
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="es. cantina@example.com"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm shadow-sm focus:border-spst-orange focus:outline-none focus:ring-1 focus:ring-spst-orange/70"
            />
          </div>

          <button
            type="button"
            onClick={handleLoadCliente}
            disabled={!email.trim() || loading}
            className="inline-flex items-center justify-center gap-1 rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white shadow-sm hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            <Search className="h-4 w-4" />
            {loading ? "Carico..." : "Carica impostazioni"}
          </button>
        </div>

        {error && (
          <p className="mt-2 text-xs text-red-600">
            {error}
          </p>
        )}

        {/* Card dati cliente */}
        {hasCliente && fields && (
          <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-xs text-slate-700">
            <div className="mb-2 flex items-center gap-2">
              <UserCircle2 className="h-4 w-4 text-slate-500" />
              <span className="font-semibold">
                {fields["Mittente"] || "Cliente senza ragione sociale impostata"}
              </span>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="flex items-start gap-2">
                <MapPin className="mt-0.5 h-3.5 w-3.5 text-slate-500" />
                <div>
                  <div>
                    {fields["Indirizzo Mittente"] || "—"}
                  </div>
                  <div>
                    {fields["CAP Mittente"] || "—"}{" "}
                    {fields["Città Mittente"] || ""}
                  </div>
                  <div>
                    {fields["Paese Mittente"] || "—"}
                  </div>
                </div>
              </div>
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <Phone className="h-3.5 w-3.5 text-slate-500" />
                  <span>{fields["Telefono Mittente"] || "—"}</span>
                </div>
                <div className="text-[11px] text-slate-500">
                  P.IVA: {fields["Partita IVA Mittente"] || "—"}
                </div>
              </div>
            </div>
          </div>
        )}

        {!hasCliente && !loading && email.trim() !== "" && !error && (
          <p className="mt-3 text-xs text-slate-500">
            Nessuna impostazione trovata per questa mail. Puoi comunque aprire
            il form e compilare manualmente i dati di mittente.
          </p>
        )}
      </div>

      {/* Scelta tipo spedizione */}
      <div className="rounded-2xl border bg-white p-4 shadow-sm">
        <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-slate-400 mb-3">
          <Boxes className="h-3 w-3" />
          <span>Tipo spedizione</span>
        </div>

        <p className="mb-3 text-xs text-slate-600">
          Una volta selezionata la mail cliente, apri il flusso desiderato.
          Il form sarà identico all&apos;area riservata, ma verrà creato per la
          mail selezionata.
        </p>

        <div className="flex flex-col gap-3 sm:flex-row">
          <Link
            href={vinoHref || "#"}
            prefetch={false}
            className={`inline-flex flex-1 items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium shadow-sm ${
              vinoHref
                ? "border-spst-orange/60 bg-spst-orange/10 text-spst-orange hover:bg-spst-orange/20"
                : "cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400"
            }`}
          >
            <Wine className="h-4 w-4" />
            <span>Apri form spedizione vino</span>
          </Link>

          <Link
            href={altroHref || "#"}
            prefetch={false}
            className={`inline-flex flex-1 items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium shadow-sm ${
              altroHref
                ? "border-slate-900 bg-slate-900 text-white hover:bg-slate-800"
                : "cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400"
            }`}
          >
            <Boxes className="h-4 w-4" />
            <span>Apri form altre merci</span>
          </Link>
        </div>

        <p className="mt-2 text-[11px] text-slate-500">
          I link si attivano solo dopo aver inserito una mail cliente.
        </p>
      </div>
    </div>
  );
}
