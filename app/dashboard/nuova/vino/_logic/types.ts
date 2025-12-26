// FILE: app/dashboard/nuova/vino/_logic/types.ts
import type { Party } from "@/components/nuova/PartyCard";

export type DocType =
  | "ldv"
  | "fattura_commerciale"
  | "fattura_proforma"
  | "dle"
  | "allegato1"
  | "allegato2"
  | "allegato3"
  | "allegato4";

export type SuccessInfo = {
  recId: string;
  idSped: string;
  tipoSped: "B2B" | "B2C" | "Sample";
  incoterm: "DAP" | "DDP" | "EXW";
  dataRitiro?: string;
  colli: number;
  formato: "Pacco" | "Pallet";
  destinatario: Party;
};

export type Suggestion = { id: string; main: string; secondary?: string };

export type AddressParts = {
  indirizzo: string;
  citta: string;
  cap: string;
  paese: string;
};
