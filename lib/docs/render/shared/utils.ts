// lib/docs/render/shared/utils.ts
import type { DocParty } from "../types";

export function esc(v: any): string {
  if (v === null || v === undefined) return "";
  return String(v)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export function renderAddressBlock(party: DocParty): string {
  const lines: string[] = [];
  if (party.name) lines.push(esc(party.name));
  if (party.address.line1) lines.push(esc(party.address.line1));

  const cityLine = [party.address.postalCode, party.address.city]
    .filter(Boolean)
    .join(" ");
  if (cityLine) lines.push(esc(cityLine));

  if (party.address.country) lines.push(esc(party.address.country));
  if (party.vatNumber) lines.push("VAT / Tax ID: " + esc(party.vatNumber));
  if (party.phone) lines.push("Tel: " + esc(party.phone));
  if (party.contact) lines.push("Attn: " + esc(party.contact));

  return lines.join("<br />");
}

// Helper per numeri (es. 2 decimali)
export function formatNumber(
  value: number | null | undefined,
  decimals: number = 2
): string {
  if (value === null || value === undefined) return "";
  return Number(value).toFixed(decimals);
}

/**
 * Genera il tag HTML per il logo SPST
 * Usa un URL assoluto che funziona sia in locale che in produzione
 */
export function renderSpstLogo(): string {
  // Usa il logo da public/spst-logo.png
  // In produzione, questo sarà risolto correttamente dal server
  const logoUrl = "/spst-logo.png";
  return `<img src="${logoUrl}" alt="SPST" style="height:32px; width:auto; display:block;" />`;
}
