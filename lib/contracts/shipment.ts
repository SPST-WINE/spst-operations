// lib/contracts/shipment.ts
import { z } from "zod";

/* ───────────────── ENUM ───────────────── */

export const ShipmentTypeZ = z.enum(["B2B", "B2C", "CAMPIONATURA"]);
export type ShipmentType = z.infer<typeof ShipmentTypeZ>;

export const CurrencyZ = z.enum(["EUR", "USD", "GBP", "CHF"]);
export type Currency = z.infer<typeof CurrencyZ>;

export const ShippingFormatZ = z.enum(["PACCO", "PALLET"]);
export type ShippingFormat = z.infer<typeof ShippingFormatZ>;

export const ShipmentStatusZ = z.enum([
  "CREATA",
  "IN RITIRO",
  "IN TRANSITO",
  "CONSEGNATA",
  "ECCEZIONE",
  "ANNULLATA",
]);
export type ShipmentStatus = z.infer<typeof ShipmentStatusZ>;


/* ───────────────── PARTY ─────────────────
   - Input: campi opzionali (il form può inviare parziale)
   - Output: campi sempre presenti ma nullabili (più comodo per UI)
*/

export const PartyInputZ = z.object({
  rs: z.string().trim().min(1).nullable().optional(),
  referente: z.string().trim().min(1).nullable().optional(),
  telefono: z.string().trim().min(1).nullable().optional(),
  piva: z.string().trim().min(1).nullable().optional(),
  paese: z.string().trim().min(1).nullable().optional(),
  citta: z.string().trim().min(1).nullable().optional(),
  cap: z.string().trim().min(1).nullable().optional(),
  indirizzo: z.string().trim().min(1).nullable().optional(),
});
export type PartyInput = z.infer<typeof PartyInputZ>;

export const PartyOutputZ = z.object({
  rs: z.string().nullable(),
  referente: z.string().nullable(),
  telefono: z.string().nullable(),
  piva: z.string().nullable(),
  paese: z.string().nullable(),
  citta: z.string().nullable(),
  cap: z.string().nullable(),
  indirizzo: z.string().nullable(),
});
export type PartyOutput = z.infer<typeof PartyOutputZ>;

/* ───────────────── PACKAGES ───────────────── */

export const PackageInputZ = z.object({
  contenuto: z.string().trim().min(1).nullable().optional(),
  peso_reale_kg: z.number().positive().nullable().optional(),
  lato1_cm: z.number().positive().nullable().optional(),
  lato2_cm: z.number().positive().nullable().optional(),
  lato3_cm: z.number().positive().nullable().optional(),
});
export type PackageInput = z.infer<typeof PackageInputZ>;

export const PackageRowZ = z.object({
  id: z.string(),
  peso_reale_kg: z.number().nullable(),
  lato1_cm: z.number().nullable(),
  lato2_cm: z.number().nullable(),
  lato3_cm: z.number().nullable(),
  contenuto: z.string().nullable(),
  created_at: z.string().nullable(),
});
export type PackageRow = z.infer<typeof PackageRowZ>;

/* ───────────────── ATTACHMENTS ───────────────── */

export const AttachmentZ = z
  .object({
    url: z.string().nullable().optional(),
    file_name: z.string().nullable().optional(),
    mime_type: z.string().nullable().optional(),
    size: z.number().nullable().optional(),
    updated_at: z.string().nullable().optional(),
  })
  .passthrough();

export type Attachment = z.infer<typeof AttachmentZ>;

export const AttachmentsZ = z
  .object({
    ldv: AttachmentZ.nullable().optional(),
    fattura_proforma: AttachmentZ.nullable().optional(),
    fattura_commerciale: AttachmentZ.nullable().optional(),
    dle: AttachmentZ.nullable().optional(),
    allegato1: AttachmentZ.nullable().optional(),
    allegato2: AttachmentZ.nullable().optional(),
    allegato3: AttachmentZ.nullable().optional(),
    allegato4: AttachmentZ.nullable().optional(),
  })
  .passthrough();

export type Attachments = z.infer<typeof AttachmentsZ>;

/* ───────────────── INPUT ─────────────────
   Nota: email_cliente NON required (client lo imposta API dalla sessione)
*/

export const ShipmentInputZ = z.object({
  email_cliente: z.string().email().nullable().optional(),

  tipo_spedizione: ShipmentTypeZ,
  incoterm: z.string().trim().min(1).nullable().optional(),
  declared_value: z.number().nonnegative().nullable().optional(),
  fatt_valuta: CurrencyZ.nullable().optional(),

  giorno_ritiro: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  pickup_at: z.string().datetime().nullable().optional(),
  note_ritiro: z.string().trim().min(1).nullable().optional(),

  formato_sped: ShippingFormatZ.nullable().optional(),
  contenuto_generale: z.string().trim().min(1).nullable().optional(),

  mittente: PartyInputZ,

  destinatario: PartyInputZ.extend({
    abilitato_import: z.boolean().nullable().optional(),
  }).nullable().optional(),

  fatturazione: PartyInputZ.nullable().optional(),

  // ✅ può essere vuoto (bozza o inserimento colli dopo)
  colli: z.array(PackageInputZ).default([]),

  extras: z.record(z.any()).optional(),
});

export type ShipmentInput = z.infer<typeof ShipmentInputZ>;

/* ───────────────── DTO (OUTPUT) ───────────────── */

export type ShipmentDTO = {
  id: string;
  human_id: string | null;
  created_at: string;

  customer_id: string | null;
  email_cliente: string | null;

 
  carrier: string | null;
  service_code: string | null;
  tracking_code: string | null;

  tipo_spedizione: ShipmentType | null;
  incoterm: string | null;
  declared_value: number | null;
  fatt_valuta: Currency | null;

  giorno_ritiro: string | null;
  pickup_at: string | null;
  note_ritiro: string | null;

  formato_sped: ShippingFormat | null;
  contenuto_generale: string | null;

  mittente: PartyOutput;

  destinatario: (PartyOutput & { abilitato_import: boolean | null }) | null;

  fatturazione: PartyOutput | null;

  colli_n: number | null;
  peso_reale_kg: number | null;

  packages: PackageRow[];

  attachments: Attachments | null;

  status: ShipmentStatus | null;


  // ✅ alias stabile per fields
  extras: Record<string, any> | null;
};
