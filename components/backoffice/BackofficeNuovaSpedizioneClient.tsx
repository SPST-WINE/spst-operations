// components/backoffice/BackofficeNuovaSpedizioneClient.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, Loader2, Mail } from "lucide-react";

type CustomerLite = {
  id: string;
  email: string;
  company_name?: string | null;
  name?: string | null;
  phone?: string | null;
  vat_number?: string | null;
};

type MittenteSettings = {
  paese?: string;
  citta?: string;
  cap?: string;
  indirizzo?: string;
  ragioneSociale?: string;
  telefono?: string;
  piva?: string;
  eori?: string;
  [key: string]: any;
};

export default function BackofficeNuovaSpedizioneClient() {
  const router = useRouter();

  const [emailInput, setEmailInput] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerLite | null>(null);
  const [mittente, setMittente] = useState<MittenteSettings | null>(null);

  const [searchResults, setSearchResults] = useState<CustomerLite[]>([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [loadingSearch, setLoadingSearch] = useState(false);
  const [loadingSettings, setLoadingSettings] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  // ---- Ricerca clienti per email / nome ------------------------------------
  useEffect(() => {
    if (!emailInput || emailInput.trim().length < 2) {
      setSearchResults([]);
      setSearchOpen(false);
      return;
    }

    if (debounceRef.current) clearTimeout(debounceRef.current);

    debounceRef.current = setTimeout(async () => {
      try {
        setLoadingSearch(true);
        setSearchOpen(true);
        setError(null);

        const res = await fetch(
          `/api/customers/search?q=${encodeURIComponent(emailInput)}&limit=10`,
          { cache: "no-store" }
        );

        const json = await res.json().catch(() => null);
        if (!json?.ok) {
          setError("Errore nel caricamento dei clienti");
          setSearchResults([]);
          return;
        }

        setSearchResults(json.customers || []);
      } catch (e) {
        console.error(e);
        setError("Errore nel caricamento dei clienti");
        setSearchResults([]);
      } finally {
        setLoadingSearch(false);
      }
    }, 250);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [emailInput]);

  // ---- Carica impostazioni mittente per la mail scelta --------------------
  async function loadImpostazioni(email: string) {
    if (!email) return;
    try {
      setLoadingSettings(true);
      setError(null);
      setMittente(null);

      const res = await fetch(
        `/api/backoffice/impostazioni?email=${encodeURIComponent(email)}`,
        {
          cache: "no-store",
          headers: {
            "x-spst-email": email,
          },
        }
      );

      const json = await res.json().catch(() => null);
      if (!json?.ok) {
        setError("Non sono riuscito a caricare le impostazioni per questa mail");
        return;
      }

      // La route restituisce { ok, email, mittente }
      setMittente(json.mittente || null);
    } catch (e) {
      console.error(e);
      setError("Errore caricamento impostazioni");
    } finally {
      setLoadingSettings(false);
    }
  }

  function handleSelectCustomer(c: CustomerLite) {
    setSelectedCustomer(c);
    setEmailInput(c.email);
    setSearchResults([]);
    setSearchOpen(false);
    // appena selezionato il cliente, carichiamo le impostazioni
    loadImpostazioni(c.email);
  }

  const canOpenForms = !!emailInput;

  function openFormVino() {
  if (!canOpenForms) return;
  const url = `/dashboard/nuova/vino?as_email=${encodeURIComponent(
    emailInput.trim()
  )}`;
  if (typeof window !== "undefined") {
    window.open(url, "_blank", "noopener,noreferrer");
  }
}

function openFormAltro() {
  if (!canOpenForms) return;
  const url = `/dashboard/nuova/altro?as_email=${encodeURIComponent(
    emailInput.trim()
  )}`;
  if (typeof window !== "undefined") {
    window.open(url, "_blank", "noopener,noreferrer");
  }
}

  return (
    <div className="space-y-4">
      {/* Card: selezione cliente */}
      <div className="rounded-2xl border bg-white p-4 text-sm space-y-4">
        <div className="flex items-center justify-between gap-2">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Seleziona cliente
          </div>
        </div>

        <div className="relative">
          <label className="mb-1 block text-xs font-medium text-slate-600">
            Mail cliente
          </label>
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                <Mail className="h-4 w-4" />
              </span>
              <input
                type="email"
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-9 py-2 text-sm outline-none ring-0 transition focus:border-slate-400 focus:bg-white"
                placeholder="Cerca per email o nome cliente..."
                value={emailInput}
                onChange={(e) => {
                  setEmailInput(e.target.value);
                  setSelectedCustomer(null);
                  setMittente(null);
                  setError(null);
                }}
              />
              {loadingSearch && (
                <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-slate-400">
                  <Loader2 className="h-4 w-4 animate-spin" />
                </span>
              )}
            </div>

            <button
              type="button"
              onClick={() => loadImpostazioni(emailInput.trim())}
              disabled={!emailInput.trim() || loadingSettings}
              className="inline-flex items-center gap-1 rounded-xl bg-slate-900 px-3 py-2 text-xs font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loadingSettings && <Loader2 className="h-3 w-3 animate-spin" />}
              Carica impostazioni
            </button>
          </div>

          {/* Dropdown risultati ricerca */}
          {searchOpen && searchResults.length > 0 && (
            <div className="absolute z-20 mt-1 w-full rounded-xl border border-slate-200 bg-white shadow-lg">
              <ul className="max-h-64 overflow-y-auto text-sm">
                {searchResults.map((c) => (
                  <li
                    key={c.id}
                    className="cursor-pointer border-b border-slate-50 px-3 py-2 hover:bg-slate-50"
                    onClick={() => handleSelectCustomer(c)}
                  >
                    <div className="font-medium text-slate-800">{c.email}</div>
                    <div className="text-[11px] text-slate-500">
                      {(c.company_name || c.name) && (
                        <>
                          {c.company_name || c.name}
                          {" · "}
                        </>
                      )}
                      {c.phone && <span>{c.phone}</span>}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {searchOpen && !loadingSearch && searchResults.length === 0 && emailInput.length >= 2 && (
            <div className="absolute z-10 mt-1 w-full rounded-xl border border-dashed border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-500">
              Nessun cliente trovato per questa ricerca.
            </div>
          )}
        </div>

        {/* Stato impostazioni / riepilogo mittente */}
        <div className="mt-2 text-xs text-slate-600">
          {error && (
            <div className="rounded-xl bg-red-50 px-3 py-2 text-[11px] text-red-700">
              {error}
            </div>
          )}

          {!error && !mittente && emailInput && (
            <div className="rounded-xl bg-slate-50 px-3 py-2 text-[11px] text-slate-600">
              Nessuna impostazione trovata per questa mail. Puoi comunque aprire
              i form e compilare manualmente i dati di mittente.
            </div>
          )}

          {!error && mittente && (
            <div className="rounded-xl bg-emerald-50 px-3 py-2 text-[11px] text-emerald-800">
              <div className="font-semibold">Impostazioni trovate per questa mail.</div>
              <div className="mt-1 space-y-0.5">
                {mittente.ragioneSociale && (
                  <div>{mittente.ragioneSociale}</div>
                )}
                {(mittente.indirizzo || mittente.cap || mittente.citta) && (
                  <div>
                    {mittente.indirizzo}{" "}
                    {[mittente.cap, mittente.citta].filter(Boolean).join(" ")}
                  </div>
                )}
                {mittente.paese && <div>{mittente.paese}</div>}
                {(mittente.telefono || mittente.piva) && (
                  <div className="text-[10px] text-emerald-900/80">
                    {[mittente.telefono, mittente.piva].filter(Boolean).join(" · ")}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Card: tipo spedizione / apertura form */}
      <div className="rounded-2xl border bg-white p-4 text-sm space-y-3">
        <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Tipo spedizione
        </div>
        <p className="text-xs text-slate-600 max-w-2xl">
          Una volta selezionata la mail cliente, apri il flusso desiderato. Il form sarà
          identico all&apos;area riservata, ma verrà creato per la mail selezionata.
        </p>

        <div className="mt-2 flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            onClick={openFormVino}
            disabled={!canOpenForms}
            className="flex-1 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-medium text-amber-900 shadow-sm transition hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-60"
          >
            🍷 Apri form spedizione vino
          </button>

          <button
            type="button"
            onClick={openFormAltro}
            disabled={!canOpenForms}
            className="flex-1 rounded-xl border border-slate-900 bg-slate-900 px-4 py-3 text-xs font-medium text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            📦 Apri form altre merci
          </button>
        </div>

        {!canOpenForms && (
          <p className="mt-1 text-[11px] text-slate-500">
            I link si attivano solo dopo aver inserito o selezionato una mail cliente.
          </p>
        )}
      </div>
    </div>
  );
}
