// components/backoffice/quote-detail/utils.ts

// chiavi tolleranti per i colli (come pagina cliente)
export const QTY_KEYS = ["quantita", "Quantita", "Quantità", "Qty", "Q.ta"];
export const L_KEYS = ["lunghezza_cm", "L_cm", "Lato 1", "Lato1", "Lunghezza", "L"];
export const W_KEYS = ["larghezza_cm", "W_cm", "Lato 2", "Lato2", "Larghezza", "W"];
export const H_KEYS = ["altezza_cm", "H_cm", "Lato 3", "Lato3", "Altezza", "H"];
export const PESO_KEYS = ["peso_kg", "Peso", "Peso (Kg)", "Peso_Kg", "Kg", "Weight"];

export function formatDateTime(s?: string | null) {
  if (!s) return "—";
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return s;
  return d.toLocaleString("it-IT", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatDate(s?: string | null) {
  if (!s) return "—";
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return s;
  return d.toLocaleDateString("it-IT");
}

export function formatCurrency(amount?: number | null, currency?: string | null) {
  if (amount == null) return "—";
  try {
    return new Intl.NumberFormat("it-IT", {
      style: "currency",
      currency: currency || "EUR",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${currency || "EUR"}`;
  }
}

export function pickNumber(f: any, keys: string[]) {
  for (const k of keys) {
    const v = f?.[k];
    const n =
      typeof v === "number"
        ? v
        : v != null && v !== ""
        ? Number(String(v).replace(",", "."))
        : NaN;
    if (!Number.isNaN(n)) return n;
  }
  return undefined;
}

export function toNumInput(v: any): number | null {
  if (v == null) return null;
  const s = String(v).trim().replace(",", ".");
  if (s === "") return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

export function fmtNum(n: number) {
  return Number.isFinite(n) ? String(Math.round(n * 100) / 100) : "";
}
