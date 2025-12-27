"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";

import PartyCard, { Party } from "@/components/nuova/PartyCard";
import ColliCard, { Collo } from "@/components/nuova/ColliCard";
import RitiroCard from "@/components/nuova/RitiroCard";
import FatturaCard from "@/components/nuova/FatturaCard";
import { Select } from "@/components/nuova/Field";

import { blankParty, INFO_URL_DEFAULT, WHATSAPP_URL_DEFAULT } from "../vino/_logic/constants";
import { dateToYMD, mapFormato, mapParty, mapTipoSped, toNull, toNumOrNull } from "../vino/_logic/helpers";

import { createShipmentWithAuth } from "../vino/_services/shipments.client";
import { uploadShipmentDocument } from "../vino/_services/upload.client";
import type { DocType } from "../vino/_logic/types";

import { usePrefillMittente } from "../vino/_hooks/usePrefillMittente";
import { usePlacesAutocomplete } from "../vino/_places/usePlacesAutocomplete";

type SuccessInfo = {
  recId: string;     // UUID DB
  humanId: string;   // SP-xx-xx-xxxx-xxxxx
  tipoSped: "B2B" | "B2C" | "Sample";
  incoterm: "DAP" | "DDP" | "EXW";
  dataRitiro?: string;
  colli: number;
  formato: "Pacco" | "Pallet";
  destinatario: Party;
};

export default function NuovaAltroPageInner() {
  const router = useRouter();
  const topRef = useRef<HTMLDivElement>(null);

  // ✅ Supabase client (come vino)
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  // Stato form
  const [tipoSped, setTipoSped] = useState<"B2B" | "B2C" | "Sample">("B2B");
  const [destAbilitato, setDestAbilitato] = useState(false);

  const [mittente, setMittente] = useState<Party>(blankParty);
  const [destinatario, setDestinatario] = useState<Party>(blankParty);

  // Prefill mittente (uguale vino)
  const applyMittentePrefill = useCallback((m: any) => {
    setMittente((prev) => ({
      ...prev,
      ragioneSociale: m.mittente || prev.ragioneSociale,
      indirizzo: m.indirizzo || prev.indirizzo,
      cap: m.cap || prev.cap,
      citta: m.citta || prev.citta,
      paese: m.paese || prev.paese,
      telefono: m.telefono || prev.telefono,
      piva: m.piva || prev.piva,
    }));
  }, []);

  usePrefillMittente({ supabase, onPrefill: applyMittentePrefill });

  // Autocomplete Places (uguale vino)
  usePlacesAutocomplete({
    onPick: (who, addr) => {
      if (who === "mittente") setMittente((p) => ({ ...p, ...addr }));
      else setDestinatario((p) => ({ ...p, ...addr }));
    },
  });

  // Colli
  const [colli, setColli] = useState<Collo[]>([
    { lunghezza_cm: null, larghezza_cm: null, altezza_cm: null, peso_kg: null },
  ]);

  const [formato, setFormato] = useState<"Pacco" | "Pallet">("Pacco");
  const [contenuto, setContenuto] = useState("");

  const [assicurazionePallet, setAssicurazionePallet] = useState(false);
  const [valoreAssicurato, setValoreAssicurato] = useState<number | null>(null);

  useEffect(() => {
    if (formato !== "Pallet") {
      if (assicurazionePallet) setAssicurazionePallet(false);
      if (valoreAssicurato != null) setValoreAssicurato(null);
    }
  }, [formato, assicurazionePallet, valoreAssicurato]);

  // Ritiro
  const [ritiroData, setRitiroData] = useState<Date | undefined>();
  const [ritiroNote, setRitiroNote] = useState("");

  // Fattura
  const [incoterm, setIncoterm] = useState<"DAP" | "DDP" | "EXW">("DAP");
  const [valuta, setValuta] = useState<"EUR" | "USD" | "GBP">("EUR");
  const [noteFatt, setNoteFatt] = useState("");

  const [delega, setDelega] = useState(false);
  const [fatturazione, setFatturazione] = useState<Party>(blankParty);
  const [sameAsDest, setSameAsDest] = useState(false);
  const [fatturaFile, setFatturaFile] = useState<File | undefined>();

  // UI
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [success, setSuccess] = useState<SuccessInfo | null>(null);

  useEffect(() => {
    if (errors.length && topRef.current) {
      topRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [errors.length]);

  function validate(): string[] {
    const errs: string[] = [];

    if (!mittente.piva?.trim()) errs.push("Partita IVA del mittente mancante.");

    colli.forEach((c, i) => {
      if (
        c.lunghezza_cm == null ||
        c.larghezza_cm == null ||
        c.altezza_cm == null ||
        c.peso_kg == null ||
        c.lunghezza_cm <= 0 ||
        c.larghezza_cm <= 0 ||
        c.altezza_cm <= 0 ||
        c.peso_kg <= 0
      ) {
        errs.push(`Collo #${i + 1}: misure o peso mancanti/non validi.`);
      }
    });

    if (!ritiroData) errs.push("Giorno ritiro mancante.");

    if (formato === "Pallet" && assicurazionePallet) {
      if (valoreAssicurato == null || valoreAssicurato <= 0) {
        errs.push("Valore assicurato mancante/non valido (assicurazione attiva).");
      }
    }

    const fatt = sameAsDest ? destinatario : fatturazione;

    // se carichi file, non obbligo campi fatturazione
    if (!fatturaFile) {
      if (!fatt.ragioneSociale?.trim()) errs.push("Ragione sociale fattura mancante.");
      if ((tipoSped === "B2B" || tipoSped === "Sample") && !fatt.piva?.trim()) {
        errs.push("PIVA obbligatoria per B2B/Sample.");
      }
    }

    return errs;
  }

  const salva = async () => {
    if (saving) return;

    const v = validate();
    if (v.length) {
      setErrors(v);
      return;
    }
    setErrors([]);
    setSaving(true);

    try {
      const payload = {
        tipo_spedizione: mapTipoSped(tipoSped),
        incoterm: toNull(incoterm),
        declared_value:
          formato === "Pallet" && assicurazionePallet ? (valoreAssicurato ?? null) : null,
        fatt_valuta: (valuta as any) ?? null,

        giorno_ritiro: ritiroData ? dateToYMD(ritiroData) : null,
        note_ritiro: toNull(ritiroNote),

        formato_sped: mapFormato(formato),
        contenuto_generale: toNull(contenuto),

        mittente: mapParty(mittente),

        destinatario: destAbilitato
          ? { ...mapParty(destinatario), abilitato_import: true }
          : mapParty(destinatario),

        fatturazione: sameAsDest ? mapParty(destinatario) : mapParty(fatturazione),

        colli: (colli || [])
          .filter(
            (c) =>
              c && (c.peso_kg || c.lunghezza_cm || c.larghezza_cm || c.altezza_cm)
          )
          .map((c) => ({
            contenuto: toNull(contenuto),
            peso_reale_kg: toNumOrNull(c.peso_kg),
            lato1_cm: toNumOrNull(c.lunghezza_cm),
            lato2_cm: toNumOrNull(c.larghezza_cm),
            lato3_cm: toNumOrNull(c.altezza_cm),
          })),

        extras: {
          sorgente: "altro",
          destAbilitato: destAbilitato ? true : false,
          assicurazioneAttiva: formato === "Pallet" ? assicurazionePallet : false,
          valoreAssicurato:
            formato === "Pallet" && assicurazionePallet ? (valoreAssicurato ?? null) : null,
          noteFatt: toNull(noteFatt),
          fattSameAsDest: sameAsDest,
          fattDelega: delega ? true : false,
          fatturaFileName: fatturaFile?.name || null,
        },
      };

      // ✅ come vino
      const created = await createShipmentWithAuth(supabase, payload);

      // Upload fattura (se presente) via API /upload (come vino)
      if (fatturaFile) {
        const docType: DocType = "fattura_commerciale";
        await uploadShipmentDocument(created.recId, fatturaFile, docType);
      }

      setSuccess({
        recId: created.recId,
        humanId: created.humanId,
        tipoSped,
        incoterm,
        dataRitiro: ritiroData?.toLocaleDateString(),
        colli: colli.length,
        formato,
        destinatario,
      });

      topRef.current?.scrollIntoView({ behavior: "smooth" });
    } catch (e: any) {
      setErrors([e?.message || "Errore salvataggio."]);
      console.error("Errore salvataggio spedizione (altro)", e);
    } finally {
      setSaving(false);
    }
  };

  // SUCCESS UI (uguale come stile vino)
  if (success) {
    const INFO_URL = process.env.NEXT_PUBLIC_INFO_URL || INFO_URL_DEFAULT;
    const WHATSAPP_URL_BASE =
      process.env.NEXT_PUBLIC_WHATSAPP_URL || WHATSAPP_URL_DEFAULT;

    const whatsappHref = `${WHATSAPP_URL_BASE}?text=${encodeURIComponent(
      `Ciao SPST, ho bisogno di supporto sulla spedizione ${success.humanId}`
    )}`;

    return (
      <div className="space-y-4" ref={topRef}>
        <h2 className="text-lg font-semibold">Spedizione creata</h2>

        <div className="rounded-2xl border bg-white p-4">
          <div className="mb-3 text-sm">
            <div className="font-medium">ID Spedizione</div>
            <div className="font-mono">{success.humanId}</div>
          </div>

          <div className="grid gap-3 md:grid-cols-2 text-sm">
            <div>
              <span className="text-slate-500">Tipo:</span> {success.tipoSped}
            </div>
            <div>
              <span className="text-slate-500">Incoterm:</span> {success.incoterm}
            </div>
            <div>
              <span className="text-slate-500">Data ritiro:</span>{" "}
              {success.dataRitiro ?? "—"}
            </div>
            <div>
              <span className="text-slate-500">Colli:</span> {success.colli} (
              {success.formato})
            </div>
            <div className="md:col-span-2">
              <span className="text-slate-500">Destinatario:</span>{" "}
              {success.destinatario.ragioneSociale || "—"}
              {success.destinatario.citta ? ` — ${success.destinatario.citta}` : ""}
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => router.push("/dashboard/spedizioni")}
              className="rounded-lg border bg-white px-4 py-2 text-sm hover:bg-slate-50"
            >
              Le mie spedizioni
            </button>

            <a
              href={INFO_URL}
              className="rounded-lg border bg-white px-4 py-2 text-sm hover:bg-slate-50"
            >
              Documenti & info utili
            </a>

            <a
              href={whatsappHref}
              target="_blank"
              className="rounded-lg border px-4 py-2 text-sm hover:bg-slate-50"
              style={{ borderColor: "#f7911e" }}
            >
              Supporto WhatsApp
            </a>

            <span className="text-sm text-green-700">Email di conferma inviata ✅</span>
          </div>

          <div className="mt-6 text-xs text-slate-500">
            Suggerimento: conserva l’ID per future comunicazioni.
          </div>
        </div>
      </div>
    );
  }

  // FORM UI
  return (
    <div className="space-y-4" ref={topRef}>
      <h2 className="text-lg font-semibold">Nuova spedizione — altro</h2>

      {!!errors.length && (
        <div className="rounded-xl border border-red-300 bg-red-50 p-3 text-sm text-red-800">
          <div className="mb-1 font-medium">Controlla questi campi:</div>
          <ul className="ml-5 list-disc space-y-1">
            {errors.map((e, i) => (
              <li key={i}>{e}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="rounded-2xl border bg-white p-4">
        <Select
          label="Stai spedendo ad un privato? O ad una azienda?"
          value={tipoSped}
          onChange={(v) => setTipoSped(v as any)}
          options={[
            { label: "B2C — privato / cliente", value: "B2C" },
            { label: "B2B — azienda", value: "B2B" },
            { label: "Sample — campionatura", value: "Sample" },
          ]}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border bg-white p-4">
          <PartyCard
            title="Mittente"
            value={mittente}
            onChange={setMittente}
            gmapsTag="mittente"
          />
        </div>

        <div className="rounded-2xl border bg-white p-4">
          <PartyCard
            title="Destinatario"
            value={destinatario}
            onChange={setDestinatario}
            gmapsTag="destinatario"
            extraSwitch={{
              label: "Destinatario abilitato all’import",
              checked: destAbilitato,
              onChange: setDestAbilitato,
            }}
          />
        </div>
      </div>

      <ColliCard
        colli={colli}
        onChange={setColli}
        formato={formato}
        setFormato={setFormato}
        contenuto={contenuto}
        setContenuto={setContenuto}
        assicurazioneAttiva={assicurazionePallet}
        setAssicurazioneAttiva={setAssicurazionePallet}
        valoreAssicurato={valoreAssicurato}
        setValoreAssicurato={setValoreAssicurato}
      />

      <RitiroCard
        date={ritiroData}
        setDate={setRitiroData}
        note={ritiroNote}
        setNote={setRitiroNote}
      />

      <FatturaCard
        incoterm={incoterm}
        setIncoterm={setIncoterm}
        valuta={valuta}
        setValuta={setValuta}
        note={noteFatt}
        setNote={setNoteFatt}
        delega={delega}
        setDelega={setDelega}
        fatturazione={fatturazione}
        setFatturazione={setFatturazione}
        destinatario={destinatario}
        sameAsDest={sameAsDest}
        setSameAsDest={setSameAsDest}
        fatturaFile={fatturaFile}
        setFatturaFile={setFatturaFile}
      />

      <div className="flex justify-end">
        <button
          type="button"
          onClick={salva}
          disabled={saving}
          className="inline-flex items-center gap-2 rounded-lg border bg-white px-4 py-2 text-sm hover:bg-slate-50 disabled:opacity-50"
        >
          {saving && (
            <span className="inline-block h-4 w-4 animate-spin rounded-full border border-slate-400 border-t-transparent" />
          )}
          {saving ? "Salvataggio…" : "Salva"}
        </button>
      </div>
    </div>
  );
}
