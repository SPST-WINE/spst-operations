// dashboard/quotazioni/nuova/page.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import PartyCard, { Party } from "@/components/nuova/PartyCard";
import ColliCard, { Collo } from "@/components/nuova/ColliCard";
import RitiroCard from "@/components/nuova/RitiroCard";

import { getUserProfile, postPreventivo } from "@/lib/api";
import { getIdToken } from "@/lib/firebase-client-auth";

const blankParty: Party = {
  ragioneSociale: "",
  referente: "",
  paese: "",
  citta: "",
  cap: "",
  indirizzo: "",
  telefono: "",
  piva: "",
};

export default function NuovaQuotazionePage() {
  const router = useRouter();
  const topRef = useRef<HTMLDivElement>(null);

  // email (dal profilo) — utile se vuoi mostrarla o loggarla
  const [email, setEmail] = useState<string>("");

  // Parti
  const [mittente, setMittente] = useState<Party>(blankParty);
  const [destinatario, setDestinatario] = useState<Party>(blankParty);

  // Colli / dettagli merce
  const [colli, setColli] = useState<Collo[]>([
    { lunghezza_cm: null, larghezza_cm: null, altezza_cm: null, peso_kg: null },
  ]);
  const [formato, setFormato] = useState<"Pacco" | "Pallet">("Pacco");
  const [contenuto, setContenuto] = useState<string>("");

  // ✅ richiesto da ColliCard Props
  const [assicurazioneAttiva, setAssicurazioneAttiva] = useState<boolean>(false);

  // ✅ NEW: valore assicurato (EUR) — richiesto da ColliCard
  const [valoreAssicurato, setValoreAssicurato] = useState<number | null>(null);

  // ✅ auto-reset se torno a Pacco
  useEffect(() => {
    if (formato !== "Pallet") {
      if (assicurazioneAttiva) setAssicurazioneAttiva(false);
      if (valoreAssicurato != null) setValoreAssicurato(null);
    }
  }, [formato, assicurazioneAttiva, valoreAssicurato]);

  // Dettagli spedizione
  const [valuta, setValuta] = useState<"EUR" | "USD" | "GBP">("EUR");
  const [tipoSped, setTipoSped] = useState<"B2B" | "B2C" | "Sample">("B2C");
  const [incoterm, setIncoterm] = useState<"DAP" | "DDP" | "EXW">("DAP");

  // Ritiro
  const [ritiroData, setRitiroData] = useState<Date | undefined>(undefined);
  const [ritiroNote, setRitiroNote] = useState("");

  // Note generiche
  const [note, setNote] = useState("");

  // UI
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [ok, setOk] = useState<{ id: string; displayId?: string } | null>(null);

  // Prefill mittente da profilo & email utente
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await getUserProfile(getIdToken);
        if (!cancelled && r?.ok) {
          if (r.email) setEmail(r.email);
          if (r.party) setMittente((prev) => ({ ...prev, ...r.party }));
        }
      } catch {
        // ignora
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Validazione minima
  function validate(): string[] {
    const errs: string[] = [];
    if (!mittente.ragioneSociale?.trim())
      errs.push("Inserisci la ragione sociale del mittente.");
    if (!destinatario.ragioneSociale?.trim())
      errs.push("Inserisci la ragione sociale del destinatario.");
    if (!ritiroData) errs.push("Seleziona il giorno di ritiro.");

    const invalid = colli.some(
      (c) =>
        c.lunghezza_cm == null ||
        c.larghezza_cm == null ||
        c.altezza_cm == null ||
        c.peso_kg == null ||
        (c.lunghezza_cm ?? 0) <= 0 ||
        (c.larghezza_cm ?? 0) <= 0 ||
        (c.altezza_cm ?? 0) <= 0 ||
        (c.peso_kg ?? 0) <= 0
    );
    if (invalid) errs.push("Inserisci misure e pesi > 0 per ogni collo.");

    // ✅ opzionale ma consigliato: se pallet + assicurazione ON, valore assicurato obbligatorio > 0
    if (formato === "Pallet" && assicurazioneAttiva) {
      if (valoreAssicurato == null || valoreAssicurato <= 0) {
        errs.push("Valore assicurato mancante/non valido (assicurazione attiva).");
      }
    }

    return errs;
  }

  async function salva() {
    if (saving) return;

    const v = validate();
    if (v.length) {
      setErrors(v);
      topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    setErrors([]);

    setSaving(true);
    try {
      // ⚠️ postPreventivo tipizzato: NON aggiungere qui formato/contenuto/assicurazione/valore
      // finché non estendi QuoteCreatePayload + backend.
      const res: any = await postPreventivo(
        {
          mittente: {
            ragioneSociale: mittente.ragioneSociale,
            paese: mittente.paese,
            citta: mittente.citta,
            cap: mittente.cap,
            indirizzo: mittente.indirizzo,
            telefono: mittente.telefono || undefined,
            taxId: mittente.piva || undefined,
          },
          destinatario: {
            ragioneSociale: destinatario.ragioneSociale,
            paese: destinatario.paese,
            citta: destinatario.citta,
            cap: destinatario.cap,
            indirizzo: destinatario.indirizzo,
            telefono: destinatario.telefono || undefined,
            taxId: destinatario.piva || undefined,
          },
          colli: (colli || []).map((c) => ({
            quantita: 1,
            lunghezza_cm: c.lunghezza_cm ?? null,
            larghezza_cm: c.larghezza_cm ?? null,
            altezza_cm: c.altezza_cm ?? null,
            peso_kg: c.peso_kg ?? null,
          })),
          valuta,
          noteGeneriche: note,
          ritiroData: ritiroData ? ritiroData.toISOString() : undefined,
          tipoSped,
          incoterm,
        },
        getIdToken
      );

      setOk({ id: res?.id, displayId: res?.displayId });
      topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    } catch (e) {
      console.error("Errore creazione preventivo", e);
      setErrors(["Errore durante la creazione della quotazione. Riprova."]);
    } finally {
      setSaving(false);
    }
  }

  // Success UI
  if (ok?.id) {
    return (
      <div ref={topRef} className="space-y-4">
        <h2 className="text-lg font-semibold">Quotazione inviata</h2>
        <div className="rounded-2xl border bg-white p-4">
          <p className="text-sm">
            ID preventivo: <span className="font-mono">{ok.displayId || ok.id}</span>
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link
              href="/dashboard/quotazioni"
              className="rounded-lg border bg-white px-4 py-2 text-sm hover:bg-slate-50"
            >
              Le mie quotazioni
            </Link>
            <button
              onClick={() => router.refresh()}
              className="rounded-lg border bg-white px-4 py-2 text-sm hover:bg-slate-50"
            >
              Nuova quotazione
            </button>
          </div>
        </div>
      </div>
    );
  }

  // FORM
  return (
    <div ref={topRef} className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-slate-800">Nuova quotazione</h1>
        <Link
          href="/dashboard/quotazioni"
          className="rounded-lg border bg-white px-4 py-2 text-sm hover:bg-slate-50"
        >
          Le mie quotazioni
        </Link>
      </div>

      {!!errors.length && (
        <div className="rounded-xl border border-rose-300 bg-rose-50 p-3 text-sm text-rose-800">
          <div className="font-medium mb-1">Controlla questi campi:</div>
          <ul className="list-disc ml-5 space-y-1">
            {errors.map((e, i) => (
              <li key={i}>{e}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Mittente / Destinatario */}
      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border bg-white p-4">
          <h2 className="mb-3 text-base font-semibold text-spst-blue">Mittente</h2>
          <PartyCard value={mittente} onChange={setMittente} title="" />
        </div>
        <div className="rounded-2xl border bg-white p-4">
          <h2 className="mb-3 text-base font-semibold text-spst-blue">Destinatario</h2>
          <PartyCard value={destinatario} onChange={setDestinatario} title="" />
        </div>
      </div>

      {/* Colli / Contenuto */}
      <div className="rounded-2xl border bg-white p-4">
        <h2 className="mb-3 text-base font-semibold text-spst-blue">Colli e contenuto</h2>
        <ColliCard
          colli={colli}
          onChange={setColli}
          formato={formato}
          setFormato={setFormato}
          contenuto={contenuto}
          setContenuto={setContenuto}
          assicurazioneAttiva={assicurazioneAttiva}
          setAssicurazioneAttiva={setAssicurazioneAttiva}
          valoreAssicurato={valoreAssicurato}
          setValoreAssicurato={setValoreAssicurato}
        />
      </div>

      {/* Dettagli spedizione */}
      <div className="rounded-2xl border bg-white p-4">
        <h2 className="mb-3 text-base font-semibold text-spst-blue">Dettagli spedizione</h2>
        <div className="grid gap-3 md:grid-cols-3">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Tipo spedizione</label>
            <select
              className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-spst-blue/20"
              value={tipoSped}
              onChange={(e) => setTipoSped(e.target.value as "B2B" | "B2C" | "Sample")}
            >
              <option value="B2C">B2C</option>
              <option value="B2B">B2B</option>
              <option value="Sample">Sample</option>
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Incoterm</label>
            <select
              className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-spst-blue/20"
              value={incoterm}
              onChange={(e) => setIncoterm(e.target.value as "DAP" | "DDP" | "EXW")}
            >
              <option value="DAP">DAP</option>
              <option value="DDP">DDP</option>
              <option value="EXW">EXW</option>
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Valuta</label>
            <select
              className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-spst-blue/20"
              value={valuta}
              onChange={(e) => setValuta(e.target.value as "EUR" | "USD" | "GBP")}
            >
              <option value="EUR">EUR</option>
              <option value="USD">USD</option>
              <option value="GBP">GBP</option>
            </select>
          </div>
        </div>
      </div>

      {/* Ritiro */}
      <div className="rounded-2xl border bg-white p-4">
        <h2 className="mb-3 text-base font-semibold text-spst-blue">Ritiro</h2>
        <RitiroCard
          date={ritiroData}
          setDate={setRitiroData}
          note={ritiroNote}
          setNote={setRitiroNote}
        />
      </div>

      {/* Note */}
      <div className="rounded-2xl border bg-white p-4">
        <h2 className="mb-3 text-base font-semibold text-spst-blue">Note</h2>
        <label className="mb-1 block text-sm font-medium text-slate-700">
          Note generiche sulla spedizione
        </label>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={4}
          className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-spst-blue/20"
          placeholder="Es. orari preferiti, vincoli, dettagli utili…"
        />
      </div>

      {/* CTA */}
      <div className="flex justify-end">
        <button
          type="button"
          onClick={salva}
          disabled={saving}
          aria-busy={saving}
          className="rounded-lg border bg-white px-4 py-2 text-sm hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2"
        >
          {saving && (
            <span className="inline-block h-4 w-4 animate-spin rounded-full border border-slate-400 border-t-transparent" />
          )}
          {saving ? "Invio…" : "Invia richiesta"}
        </button>
      </div>
    </div>
  );
}
