// FILE: app/dashboard/nuova/vino/_logic/mapVinoFormToShipmentPayload.ts
import type { Party } from "@/components/nuova/PartyCard";
import type { Collo } from "@/components/nuova/ColliCard";
import type { RigaPL } from "@/components/nuova/PackingListVino";
import { dateToYMD, mapFormato, mapParty, mapTipoSped, toNull, toNumOrNull } from "./helpers";

type Args = {
  tipoSped: "B2B" | "B2C" | "Sample";
  incoterm: "DAP" | "DDP" | "EXW";
  ritiroData?: Date;
  ritiroNote: string;
  formato: "Pacco" | "Pallet";
  contenuto: string;
  mittente: Party;
  destinatario: Party;
  destAbilitato: boolean;
  fatturazione: Party;
  sameAsDest: boolean;
  valuta: "EUR" | "USD" | "GBP";
  noteFatt: string;
  delega: boolean;
  fatturaFile?: File;
  colli: Collo[];
  pl: RigaPL[];
  assicurazionePallet: boolean;
  valoreAssicurato: number | null;
};

export function mapVinoFormToShipmentPayload(a: Args) {
  return {
    tipo_spedizione: mapTipoSped(a.tipoSped),
    incoterm: toNull(a.incoterm),
    declared_value:
      a.formato === "Pallet" && a.assicurazionePallet ? (a.valoreAssicurato ?? null) : null,
    fatt_valuta: (a.valuta as any) ?? null,

    giorno_ritiro: a.ritiroData ? dateToYMD(a.ritiroData) : null,
    note_ritiro: toNull(a.ritiroNote),

    formato_sped: mapFormato(a.formato),
    contenuto_generale: toNull(a.contenuto),

    mittente: mapParty(a.mittente),

    destinatario: {
      ...mapParty(a.destinatario),
      abilitato_import: a.destAbilitato ? true : false,
    },

    fatturazione: a.sameAsDest ? mapParty(a.destinatario) : mapParty(a.fatturazione),

    colli: (a.colli || [])
      .filter(
        (c: any) =>
          c && (c.peso_kg || c.lunghezza_cm || c.larghezza_cm || c.altezza_cm)
      )
      .map((c: any) => ({
        contenuto: toNull(a.contenuto),
        peso_reale_kg: toNumOrNull(c.peso_kg),
        lato1_cm: toNumOrNull(c.lunghezza_cm),
        lato2_cm: toNumOrNull(c.larghezza_cm),
        lato3_cm: toNumOrNull(c.altezza_cm),
      })),

    extras: {
      sorgente: "vino",
      destAbilitato: a.destAbilitato ? true : false,
      assicurazioneAttiva: a.formato === "Pallet" ? a.assicurazionePallet : false,
      valoreAssicurato:
        a.formato === "Pallet" && a.assicurazionePallet ? (a.valoreAssicurato ?? null) : null,
      noteFatt: toNull(a.noteFatt),
      fattSameAsDest: a.sameAsDest,
      fattDelega: a.delega ? true : false,
      fatturaFileName: a.fatturaFile?.name || null,
      packing_list: a.pl,
    },
  };
}
