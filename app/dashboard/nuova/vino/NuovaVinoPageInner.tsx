// FILE: app/dashboard/nuova/vino/NuovaVinoPageInner.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@supabase/supabase-js";

import PartyCard, { Party } from "@/components/nuova/PartyCard";
import ColliCard, { Collo } from "@/components/nuova/ColliCard";
import RitiroCard from "@/components/nuova/RitiroCard";
import FatturaCard from "@/components/nuova/FatturaCard";
import PackingListVino, { RigaPL } from "@/components/nuova/PackingListVino";
import { Select } from "@/components/nuova/Field";

import NuovaVinoSuccess from "./NuovaVinoSuccess";
import { blankParty, DEST_PIVA_MSG } from "./_logic/constants";
import type { SuccessInfo } from "./_logic/types";
import { mapVinoFormToShipmentPayload } from "./_logic/mapVinoFormToShipmentPayload";
import { validateVinoShipment } from "./_logic/validateVinoShipment";
import { createShipmentWithAuth } from "./_services/shipments.client";
import { uploadShipmentDocument } from "./_services/upload.client";
import { usePrefillMittente } from "./_hooks/usePrefillMittente";
import { useAutoscrollErrors } from "./_hooks/useAutoscrollErrors";
import { usePlacesAutocomplete } from "./_places/usePlacesAutocomplete";

// ------------------------------------------------------------
// Supabase client (riusiamo sempre lo stesso)
// ------------------------------------------------------------
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function NuovaVinoPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const forcedEmail = searchParams.get("for");

  const [tipoSped, setTipoSped] = useState<"B2B" | "B2C" | "Sample">("B2B");
  const [destAbilitato, setDestAbilitato] = useState(false);

  const [mittente, setMittenteState] = useState<Party>(blankParty);
  const [destinatario, setDestinatario] = useState<Party>(blankParty);

  // Prefill mittente da /api/impostazioni
  usePrefillMittente({
    supabase,
    forcedEmail,
    setMittente: (fn) => setMittenteState((prev) => fn(prev)),
  });

  // Places Autocomplete
  usePlacesAutocomplete({
    onFill: (who, parts) => {
      if (who === "mittente") setMittenteState((prev) => ({ ...prev, ...parts }));
      else setDestinatario((prev) => ({ ...prev, ...parts }));
    },
  });

  const [colli, setColli] = useState<Collo[]>([
    { lunghezza_cm: null, larghezza_cm: null, altezza_cm: null, peso_kg: null },
  ]);
  const [formato, setFormato] = useState<"Pacco" | "Pallet">("Pacco");
  const [contenuto, setContenuto] = useState<string>("");

  const [assicurazionePallet, setAssicurazionePallet] = useState(false);
  const [valoreAssicurato, setValoreAssicurato] = useState<number | null>(null);

  // reset assicurazione se non pallet
  useEffect(() => {
    if (formato !== "Pallet") {
      if (assicurazionePallet) setAssicurazionePallet(false);
      if (valoreAssicurato != null) setValoreAssicurato(null);
    }
  }, [formato, assicurazionePallet, valoreAssicurato]);

  const [ritiroData, setRitiroData] = useState<Date | undefined>(undefined);
  const [ritiroNote, setRitiroNote] = useState("");
  const [incoterm, setIncoterm] = useState<"DAP" | "DDP" | "EXW">("DAP");
  const [valuta, setValuta] = useState<"EUR" | "USD" | "GBP">("EUR");
  const [noteFatt, setNoteFatt] = useState("");
  const [delega, setDelega] = useState(false);
  const [fatturazione, setFatturazione] = useState<Party>(blankParty);
  const [sameAsDest, setSameAsDest] = useState(false);
  const [fatturaFile, setFatturaFile] = useState<File | undefined>(undefined);

  const [pl, setPl] = useState<RigaPL[]>([
    {
      etichetta: "",
      tipologia: "vino fermo",
      bottiglie: 1,
      formato_litri: 0.75,
      gradazione: 12,
      prezzo: 0,
      valuta: "EUR",
      peso_netto_bott: 1.2,
      peso_lordo_bott: 1.5,
    },
  ]);

  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [success, setSuccess] = useState<SuccessInfo | null>(null);
  const topRef = useRef<HTMLDivElement>(null);

  useAutoscrollErrors(topRef as any, errors.length);

  // rimuovi msg P.IVA se passa a B2C
  useEffect(() => {
    if (tipoSped === "B2C") {
      setErrors((prev) => prev.filter((msg) => msg !== DEST_PIVA_MSG));
    }
  }, [tipoSped, destinatario.piva]);

  const salva = async () => {
    if (saving) return;

    const v = validateVinoShipment({
      tipoSped,
      mittente,
      destinatario,
      colli,
      ritiroData,
      pl,
      fatturaFile,
      fatturazione,
      sameAsDest,
      formato,
      assicurazionePallet,
      valoreAssicurato,
    });

    if (v.length) {
      setErrors(v);
      return;
    }
    setErrors([]);
    setSaving(true);

    try {
      const payload = mapVinoFormToShipmentPayload({
        tipoSped,
        incoterm,
        ritiroData,
        ritiroNote,
        formato,
        contenuto,
        mittente,
        destinatario,
        destAbilitato,
        fatturazione,
        sameAsDest,
        valuta,
        noteFatt,
        delega,
        fatturaFile,
        colli,
        pl,
        assicurazionePallet,
        valoreAssicurato,
      });

      const created = await createShipmentWithAuth(
        supabase,
        payload,
        forcedEmail || undefined
      );

      try {
        if (fatturaFile) {
          await uploadShipmentDocument(created.recId, fatturaFile, "fattura_proforma");
        }
      } catch (e) {
        console.error("Errore upload documenti:", e);
        setErrors([
          "Spedizione creata, ma si è verificato un errore durante il caricamento della fattura.",
        ]);
      }

      setSuccess({
        recId: created.recId,
        idSped: created.humanId,
        tipoSped,
        incoterm,
        dataRitiro: ritiroData?.toLocaleDateString(),
        colli: colli.length,
        formato,
        destinatario,
      });

      if (topRef.current) {
        topRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    } catch (e: any) {
      const msg =
        e?.message ||
        "Si è verificato un errore durante il salvataggio. Riprova più tardi.";
      setErrors([msg]);
      console.error("Errore salvataggio spedizione", e);
    } finally {
      setSaving(false);
    }
  };

  if (success) {
    return (
      <div className="space-y-4" ref={topRef}>
        <NuovaVinoSuccess
          success={success}
          onGoToSpedizioni={() => router.push("/dashboard/spedizioni")}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4" ref={topRef}>
      <h2 className="text-lg font-semibold">Nuova spedizione — vino</h2>

      {!!errors.length && (
        <div className="rounded-xl border border-red-300 bg-red-50 p-3 text-sm text-red-800">
          <div className="font-medium mb-1">Controlla questi errori:</div>
          <ul className="list-disc ml-5 space-y-1">
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
          onChange={(v) => setTipoSped(v as "B2B" | "B2C" | "Sample")}
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
            onChange={setMittenteState}
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

      <PackingListVino value={pl} onChange={setPl} />

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
          aria-busy={saving}
          className="rounded-lg border bg-white px-4 py-2 text-sm hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2"
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
