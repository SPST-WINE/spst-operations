// components/backoffice/quotazioni/quotazioniUtils.ts

export type TabKey = "received" | "sent";

export type QuoteReceivedRow = {
  id: string;
  human_id: string | null;
  created_at: string | null;
  email_cliente: string | null;
  tipo_spedizione: string | null;
  incoterm: string | null;
  status: string | null;
};

export type QuoteSentRow = {
  id: string;
  quote_id: string;
  label: string | null;
  carrier: string | null;
  service_name: string | null;
  total_price: number | null;
  currency: string | null;
  internal_cost: number | null;
  internal_profit: number | null;
  status: string | null;
  sent_at: string | null;
};

export function norm(s?: string | null) {
  return (s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
}

export function formatDate(dateStr?: string | null) {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("it-IT", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
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
