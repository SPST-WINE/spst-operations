// FILE: app/dashboard/nuova/vino/_logic/constants.ts
import type { Party } from "@/components/nuova/PartyCard";

export const GMAPS_LANG = process.env.NEXT_PUBLIC_GOOGLE_MAPS_LANGUAGE || "it";
export const GMAPS_REGION = process.env.NEXT_PUBLIC_GOOGLE_MAPS_REGION || "IT";

export const blankParty: Party = {
  ragioneSociale: "",
  referente: "",
  paese: "",
  citta: "",
  cap: "",
  indirizzo: "",
  telefono: "",
  piva: "",
};

export const DEST_PIVA_MSG =
  "Per le spedizioni vino di tipo B2B o Sample è obbligatoria la Partita IVA / Codice Fiscale del destinatario.";

export const INFO_URL_DEFAULT = "/dashboard/informazioni-utili";
export const WHATSAPP_URL_DEFAULT = "https://wa.me/message/CP62RMFFDNZPO1";
