"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";

import PartyCard, { Party } from "@/components/nuova/PartyCard";
import ColliCard, { Collo } from "@/components/nuova/ColliCard";
import RitiroCard from "@/components/nuova/RitiroCard";
import FatturaCard from "@/components/nuova/FatturaCard";
import { Select } from "@/components/nuova/Field";

import { createShipmentWithAuth } from "./_services/shipments.client";
import { usePrefillMittente } from "./_hooks/usePrefillMittente";

import { usePlacesAutocomplete } from "./_places/usePlacesAutocomplete";
import type { AddressParts } from "./_logic/types";

// ------------------------------------------------------------
// Tipi / costanti UI
// ------------------------------------------------------------
type SuccessInfo = {
  recId: string;
  humanId: string;
  tipoSped: "B2B" | "B2C" | "Sample";
  incoterm: "DAP" | "DDP" | "EXW";
  dataRitiro?: string;
  colli: number;
  formato: "Pacco" | "Pallet";
  destinatario: Party;
};

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

// ------------------------------------------------------------
// Helpers mapping → ShipmentInputZ (contract)
// ------------------------------------------------------------
function toNull(v?: string | null) {
  const s = (v ?? "").trim();
  return s ? s : null;
}

function toNumOrNull(v: any) {
  if (v == null) return null;
  const n = typeof v === "number" ? v : Number(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

function dateToYMD(d: Date) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function mapTipoSped(v: "B2B" | "B2C" | "Sample") {
  return v === "Sample" ? "CAMPIONATURA" : v;
}

function mapFormato(v: "Pacco" | "Pallet") {
  return v === "Pallet" ? "PALLET" : "PACCO";
}

function mapParty(p: Party) {
  return {
    rs: toNull(p.ragioneSociale),
    referente: toNull(p.referente),
    telefono: toNull(p.telefono),
    piva: toNull(p.piva),
    paese: toNull(p.paese),
    citta: toNull((p as any).citta),
    cap: toNull(p.cap),
    indirizzo: toNull(p.indirizzo),
  };
}

export default function NuovaAltroPageInner() {
  const router = useRouter();

  // Supabase client (serve per token/session in createShipmentWithAuth)
  const supabase = useRef(
    createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
  ).current;

  // Stato form
  const [tipoSped, setTipoSped] = useState<"B2B" | "B2C" | "Sample">("B2B");
  const [destAbilitato, setDestAbilitato] = useState(false);

  const [mittente, setMittente] = useState<Party>(blankParty);
  const [destinatario, setDestinatario] = useState<Party>(blankParty);

  // ✅ Prefill mittente (come vino)
  usePrefillMittente({ setMittente });

  // ✅ IMPORTANTISSIMO: onFill STABILE (evita detach/reattach loop)
  const handlePlacesFill = useCallback(
    (who: "mittente" | "destinatario", parts: AddressParts) => {
      if (who === "mittente") {
        setMittente((prev) => ({ ...prev, ...parts }));
      } else {
        setDestinatario((prev) => ({ ...prev, ...parts }));
      }
    },
    []
  );

  // ✅ Places autocomplete
  usePlacesAutocomplete({
    selectors: {
      mittente: 'input[data-gmaps="indirizzo-mittente"]',
      destinatario: 'input[data-gmaps="indirizzo-destinatario"]',
    },
    onFill: handlePlacesFill,
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

  // UI
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [success, setSuccess] = useState<SuccessInfo | null>(null);

  const topRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (errors.length && topRef.current) {
      topRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [errors.length]);

  // ------------------------------------------------------------
  // Validazione
  // ------------------------------------------------------------
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

    // ✅ Niente upload: i dati fattura sono sempre richiesti
    const fatt = sameAsDest ? destinatario : fatturazione;

    if (!fatt.ragioneSociale?.trim()) errs.push("Ragione sociale fattura mancante.");

    if ((tipoSped === "B2B" || tipoSped === "Sample") && !fatt.piva?.trim()) {
      errs.push("PIVA obbligatoria per B2B/Sample.");
    }

    return errs;
  }

  // ------------------------------------------------------------
  // SALVATAGGIO → POST /api/spedizioni
  // ------------------------------------------------------------
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
              c &&
              (c.peso_kg || c.lunghezza_cm || c.larghezza_cm || c.altezza_cm)
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
          destAbilitato: !!destAbilitato,
          assicurazioneAttiva: formato === "Pallet" ? !!assicurazionePallet : false,
          valoreAssicurato:
            formato === "Pallet" && assicurazionePallet ? (valoreAssicurato ?? null) : null,
          noteFatt: toNull(noteFatt),
          fattSameAsDest: !!sameAsDest,
          fattDelega: !!delega,
          fatturaFileName: null,
          pending_uploads: !delega ? ["fattura_proforma"] : [],
        },
      };

      const created = await createShipmentWithAuth(supabase, payload);

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
      console.error("[nuova/altro] errore salvataggio", e);
    } finally {
      setSaving(false);
    }
  };

  // ------------------------------------------------------------
  // SUCCESS UI
  // ------------------------------------------------------------
  if (success) {
    const INFO_URL =
      process.env.NEXT_PUBLIC_INFO_URL || "/dashboard/informazioni-utili";
    const WHATSAPP_URL_BASE =
      process.env.NEXT_PUBLIC_WHATSAPP_URL || "https://wa.me/message/CP62RMFFDNZPO1";

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

          <div className="grid gap-3 text-sm md:grid-cols-2">
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
              <span className="text-slate-500">Colli:</span> {success.colli} ({success.formato})
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
              rel="noreferrer"
              className="rounded-lg border px-4 py-2 text-sm hover:bg-slate-50"
              style={{ borderColor: "#f7911e" }}
            >
              Supporto WhatsApp
            </a>

            <span className="text-sm text-green-700">Creato ✅</span>
          </div>

          <div className="mt-6 text-xs text-slate-500">
            Suggerimento: conserva l’ID per future comunicazioni.
          </div>
        </div>
      </div>
    );
  }

  // ------------------------------------------------------------
  // FORM UI
  // ------------------------------------------------------------
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
