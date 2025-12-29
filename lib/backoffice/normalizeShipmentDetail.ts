// lib/backoffice/normalizeShipmentDetail.ts
// Backoffice UI helper: normalize the canonical ShipmentDTO into a flat shape
// that the backoffice detail page can render easily.

import type { ShipmentDTO } from "@/lib/contracts/shipment";

export type AttachmentInfo =
  | {
      url: string;
      file_name?: string | null;
      mime_type?: string | null;
      size?: number | null;
    }
  | null;

export type PackageRow = {
  id?: string;
  l1?: number | null;
  l2?: number | null;
  l3?: number | null;
  weight_kg?: number | null;
};

export type ShipmentDetailFlat = {
  id: string;
  created_at?: string;
  human_id?: string | null;
  email_cliente?: string | null;
  email_norm?: string | null;

  status?: string | null;
  carrier?: string | null;
  tracking_code?: string | null;

  tipo_spedizione?: string | null;
  incoterm?: string | null;
  giorno_ritiro?: string | null;
  note_ritiro?: string | null;

  mittente_rs?: string | null;
  mittente_paese?: string | null;
  mittente_citta?: string | null;
  mittente_cap?: string | null;
  mittente_indirizzo?: string | null;
  mittente_telefono?: string | null;
  mittente_piva?: string | null;

  dest_rs?: string | null;
  dest_paese?: string | null;
  dest_citta?: string | null;
  dest_cap?: string | null;
  dest_indirizzo?: string | null;
  dest_telefono?: string | null;
  dest_piva?: string | null;
  dest_abilitato_import?: boolean | null;

  fatt_rs?: string | null;
  fatt_paese?: string | null;
  fatt_citta?: string | null;
  fatt_cap?: string | null;
  fatt_indirizzo?: string | null;
  fatt_telefono?: string | null;
  fatt_piva?: string | null;
  fatt_valuta?: string | null;

  colli_n?: number | null;
  peso_reale_kg?: number | null;
  formato_sped?: string | null;
  contenuto_generale?: string | null;

  declared_value?: number | null;

  attachments?: {
    ldv?: AttachmentInfo;
    fattura_proforma?: AttachmentInfo;
    fattura_commerciale?: AttachmentInfo;
    dle?: AttachmentInfo;
    allegato1?: AttachmentInfo;
    allegato2?: AttachmentInfo;
    allegato3?: AttachmentInfo;
    allegato4?: AttachmentInfo;
  };

  packages?: PackageRow[];

  // jsonb legacy DB (esposto come extras nel DTO)
  fields?: any;
};

const toNum = (v: any): number | null => {
  if (v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

const asBool = (v: any): boolean | null => (typeof v === "boolean" ? v : null);

/**
 * Normalizza ShipmentDTO -> shape flat usata dal backoffice.
 * Importante: NON cambia contratti API, è solo un adapter UI.
 */
export function normalizeShipmentDTOToFlat(dto: ShipmentDTO): ShipmentDetailFlat {
  const mitt = dto.mittente ?? null;
  const dest = dto.destinatario ?? null;
  const fatt = dto.fatturazione ?? null;

  const packages: PackageRow[] = Array.isArray(dto.packages)
    ? dto.packages.map((p: any, idx: number) => ({
        id: p.id ?? String(idx),
        l1: toNum(p.lato1_cm) ?? toNum(p.length_cm) ?? null,
        l2: toNum(p.lato2_cm) ?? toNum(p.width_cm) ?? null,
        l3: toNum(p.lato3_cm) ?? toNum(p.height_cm) ?? null,
        // contract name is peso_reale_kg
        weight_kg: toNum(p.peso_reale_kg) ?? toNum(p.weight_kg) ?? null,
      }))
    : [];

  const flat: ShipmentDetailFlat = {
    id: dto.id,
    created_at: dto.created_at,
    human_id: dto.human_id ?? null,
    email_cliente: (dto as any).email_cliente ?? null,
    email_norm: (dto as any).email_norm ?? null,

    status: dto.status ?? null,
    carrier: dto.carrier ?? null,
    tracking_code: dto.tracking_code ?? null,

    tipo_spedizione: dto.tipo_spedizione ?? null,
    incoterm: dto.incoterm ?? null,
    giorno_ritiro: dto.giorno_ritiro ?? null,
    note_ritiro: dto.note_ritiro ?? null,

    mittente_rs: mitt?.rs ?? null,
    mittente_paese: mitt?.paese ?? null,
    mittente_citta: mitt?.citta ?? null,
    mittente_cap: mitt?.cap ?? null,
    mittente_indirizzo: mitt?.indirizzo ?? null,
    mittente_telefono: mitt?.telefono ?? null,
    mittente_piva: mitt?.piva ?? null,

    dest_rs: dest?.rs ?? null,
    dest_paese: dest?.paese ?? null,
    dest_citta: dest?.citta ?? null,
    dest_cap: dest?.cap ?? null,
    dest_indirizzo: dest?.indirizzo ?? null,
    dest_telefono: dest?.telefono ?? null,
    dest_piva: dest?.piva ?? null,
    dest_abilitato_import: asBool((dest as any)?.abilitato_import) ?? null,

    fatt_rs: fatt?.rs ?? null,
    fatt_paese: fatt?.paese ?? null,
    fatt_citta: fatt?.citta ?? null,
    fatt_cap: fatt?.cap ?? null,
    fatt_indirizzo: fatt?.indirizzo ?? null,
    fatt_telefono: fatt?.telefono ?? null,
    fatt_piva: fatt?.piva ?? null,
    fatt_valuta: dto.fatt_valuta ?? null,

    colli_n: dto.colli_n ?? null,
    peso_reale_kg: dto.peso_reale_kg ?? null,
    formato_sped: dto.formato_sped ?? null,
    contenuto_generale: dto.contenuto_generale ?? null,

    declared_value: dto.declared_value ?? null,

    attachments: (dto as any).attachments ?? undefined,
    packages,

    // DTO exposes legacy json as extras
    fields: (dto as any).extras ?? null,
  };

  return fillBillingFromDest(flat);
}

/* ─────────────────────────────────────────────────────────────
   Helper: se fatturazione è tutta vuota (NULL/""), copia dal destinatario
   ───────────────────────────────────────────────────────────── */

function isEmptyStr(x: any) {
  return x == null || (typeof x === "string" && x.trim() === "");
}

function shouldCopyBillingFromDest(s: ShipmentDetailFlat) {
  const billingEmpty =
    isEmptyStr(s.fatt_rs) &&
    isEmptyStr(s.fatt_paese) &&
    isEmptyStr(s.fatt_citta) &&
    isEmptyStr(s.fatt_cap) &&
    isEmptyStr(s.fatt_indirizzo) &&
    isEmptyStr(s.fatt_telefono) &&
    isEmptyStr(s.fatt_piva);

  const destHasSomething =
    !isEmptyStr(s.dest_rs) ||
    !isEmptyStr(s.dest_indirizzo) ||
    !isEmptyStr(s.dest_paese) ||
    !isEmptyStr(s.dest_citta) ||
    !isEmptyStr(s.dest_cap);

  return billingEmpty && destHasSomething;
}

function fillBillingFromDest(s: ShipmentDetailFlat): ShipmentDetailFlat {
  if (!shouldCopyBillingFromDest(s)) return s;

  return {
    ...s,
    fatt_rs: s.dest_rs ?? null,
    fatt_paese: s.dest_paese ?? null,
    fatt_citta: s.dest_citta ?? null,
    fatt_cap: s.dest_cap ?? null,
    fatt_indirizzo: s.dest_indirizzo ?? null,
    fatt_telefono: s.dest_telefono ?? null,
    fatt_piva: s.dest_piva ?? null,
    // fatt_valuta: NON tocchiamo (rimane com'è)
  };
}
