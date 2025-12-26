// FILE: app/dashboard/nuova/vino/_logic/helpers.ts
import type { Party } from "@/components/nuova/PartyCard";

export function toNull(v?: string | null) {
  const s = (v ?? "").trim();
  return s ? s : null;
}

export function toNumOrNull(v: any) {
  if (v == null) return null;
  const n = typeof v === "number" ? v : Number(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

export function dateToYMD(d: Date) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export function mapTipoSped(v: "B2B" | "B2C" | "Sample") {
  return v === "Sample" ? "CAMPIONATURA" : v;
}

export function mapFormato(v: "Pacco" | "Pallet") {
  return v === "Pallet" ? "PALLET" : "PACCO";
}

export function mapParty(p: Party) {
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

export function isPhoneValid(raw?: string) {
  if (!raw) return false;
  const v = raw.replace(/\s+/g, "");
  return /^\+?[1-9]\d{6,14}$/.test(v);
}
