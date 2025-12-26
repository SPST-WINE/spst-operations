// FILE: app/dashboard/nuova/vino/_logic/validateVinoShipment.ts
import type { Party } from "@/components/nuova/PartyCard";
import type { Collo } from "@/components/nuova/ColliCard";
import type { RigaPL } from "@/components/nuova/PackingListVino";
import { DEST_PIVA_MSG } from "./constants";
import { isPhoneValid } from "./helpers";

export function validatePackingList(rows: RigaPL[] | undefined): string[] {
  const out: string[] = [];
  if (!rows || rows.length === 0) {
    out.push("Packing list obbligatoria per spedizioni vino.");
    return out;
  }
  rows.forEach((r, i) => {
    const idx = `Riga PL #${i + 1}`;
    if (!r.etichetta?.trim()) out.push(`${idx}: etichetta prodotto mancante.`);
    if (!r["tipologia"])
      out.push(
        `${idx}: seleziona la tipologia (vino fermo/spumante o brochure/depliant).`
      );

    const isBrochure = r["tipologia"] === "brochure/depliant";
    if (isBrochure) {
      if (!r.bottiglie || r.bottiglie <= 0)
        out.push(`${idx}: quantità (pezzi) > 0 obbligatoria per brochure/depliant.`);
      if (r.peso_netto_bott == null || r.peso_netto_bott <= 0)
        out.push(`${idx}: peso netto/pezzo (kg) obbligatorio per brochure/depliant.`);
      if (r.peso_lordo_bott == null || r.peso_lordo_bott <= 0)
        out.push(`${idx}: peso lordo/pezzo (kg) obbligatorio per brochure/depliant.`);
    } else {
      if (!r.bottiglie || r.bottiglie <= 0)
        out.push(`${idx}: numero bottiglie > 0 obbligatorio.`);
      if (r.formato_litri == null || r.formato_litri <= 0)
        out.push(`${idx}: formato bottiglia (L) obbligatorio.`);
      if (r.gradazione == null || Number.isNaN(r.gradazione))
        out.push(`${idx}: gradazione alcolica (% vol) obbligatoria.`);
      else if (r.gradazione < 4 || r.gradazione > 25)
        out.push(`${idx}: gradazione fuori range plausibile (4–25% vol).`);
      if (r.peso_netto_bott == null || r.peso_netto_bott <= 0)
        out.push(`${idx}: peso netto/bottiglia (kg) obbligatorio.`);
      if (r.peso_lordo_bott == null || r.peso_lordo_bott <= 0)
        out.push(`${idx}: peso lordo/bottiglia (kg) obbligatorio.`);
    }
  });
  return out;
}

type Args = {
  tipoSped: "B2B" | "B2C" | "Sample";
  mittente: Party;
  destinatario: Party;
  colli: Collo[];
  ritiroData?: Date;
  pl: RigaPL[];
  fatturaFile?: File;
  fatturazione: Party;
  sameAsDest: boolean;
  formato: "Pacco" | "Pallet";
  assicurazionePallet: boolean;
  valoreAssicurato: number | null;
};

export function validateVinoShipment(a: Args): string[] {
  const errs: string[] = [];

  if (!isPhoneValid(a.mittente.telefono))
    errs.push(
      "Telefono mittente obbligatorio in formato internazionale (es. +393201441789)."
    );

  if (!isPhoneValid(a.destinatario.telefono))
    errs.push("Telefono destinatario obbligatorio in formato internazionale.");

  if ((a.tipoSped === "B2B" || a.tipoSped === "Sample") && !a.destinatario.piva?.trim()) {
    errs.push(DEST_PIVA_MSG);
  }

  if (!a.mittente.piva?.trim())
    errs.push("Partita IVA/Codice Fiscale del mittente mancante.");

  (a.colli || []).forEach((c: any, i: number) => {
    const miss =
      c.lunghezza_cm == null ||
      c.larghezza_cm == null ||
      c.altezza_cm == null ||
      c.peso_kg == null;
    const nonPos =
      (c.lunghezza_cm ?? 0) <= 0 ||
      (c.larghezza_cm ?? 0) <= 0 ||
      (c.altezza_cm ?? 0) <= 0 ||
      (c.peso_kg ?? 0) <= 0;

    if (miss || nonPos)
      errs.push(`Collo #${i + 1}: inserire tutte le misure e un peso > 0.`);
  });

  if (!a.ritiroData) errs.push("Seleziona il giorno di ritiro.");

  errs.push(...validatePackingList(a.pl));

  if (!a.fatturaFile) {
    const fatt = a.sameAsDest ? a.destinatario : a.fatturazione;
    if (!fatt.ragioneSociale?.trim())
      errs.push("Dati fattura: ragione sociale mancante.");
    if ((a.tipoSped === "B2B" || a.tipoSped === "Sample") && !fatt.piva?.trim()) {
      errs.push("Dati fattura: P.IVA/CF obbligatoria per B2B e Campionatura.");
    }
  }

  if (a.formato === "Pallet" && a.assicurazionePallet) {
    if (a.valoreAssicurato == null || a.valoreAssicurato <= 0) {
      errs.push("Valore assicurato mancante/non valido (assicurazione attiva).");
    }
  }

  return errs;
}

