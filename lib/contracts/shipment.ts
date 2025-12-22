// lib/contracts/shipment.ts
import { z } from "zod";

/* ───────────────── ENUM ───────────────── */

export const ShipmentTypeZ = z.enum(["B2B", "B2C", "CAMPIONATURA"]);
export type ShipmentType = z.infer<typeof ShipmentTypeZ>;

export const CurrencyZ = z.enum(["EUR", "USD", "GBP", "CHF"]);
export type Currency = z.infer<typeof CurrencyZ>;

export const ShippingFormatZ = z.enum(["PACCO", "PALLET"]);
export type ShippingFormat = z.infer<typeof ShippingFormatZ>;

/* ───────────────── PARTY ───────────────── */

export const PartyZ = z.object({
  rs: z.string().trim().min(1).nullable().optional(),
  referente: z.string().trim().min(1).nullable().optional(),
  telefono: z.string().trim().min(1).nullable().optional(),
  piva: z.string().trim().min(1).nullable().optional(),
  paese: z.string().trim().min(1).nullable().optional(),
  citta: z.string().trim().min(1).nullable().optional(),
  cap: z.string().trim().min(1).nullable().optional(),
  indirizzo: z.string().trim().min(1).nullable().optional(),
});

export type PartyInput = z.infer<typeof PartyZ>;

/* ───────────────── PACKAGES ───────────────── */

export const PackageZ = z.object({
  contenuto: z.string().trim().min(1).nullable().optional(),
  peso_reale_kg: z.number().positive(),
  lato1_cm: z.number().positive(),
  lato2_cm: z.number().positive(),
  lato3_cm: z.number().positive(),
});

export type PackageInput = z.infer<typeof PackageZ>;

/* ───────────────── INPUT ───────────────── */

export const ShipmentInputZ = z.object({
  email_cliente: z.string().email(),

  tipo_spedizione: ShipmentTypeZ,
  incoterm: z.string().trim().min(1).nullable().optional(),
  declared_value: z.number().nonnegative().nullable().optional(),
  fatt_valuta: CurrencyZ.nullable().optional(),

  giorno_ritiro: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  pickup_at: z.string().datetime().nullable().optional(),
  note_ritiro: z.string().trim().min(1).nullable().optional(),

  formato_sped: ShippingFormatZ.nullable().optional(),
  contenuto_generale: z.string().trim().min(1).nullable().optional(),

  mittente: PartyZ,

  destinatario: PartyZ.extend({
    abilitato_import: z.boolean().nullable().optional(),
  }).nullable().optional(),

  fatturazione: PartyZ.nullable().optional(),

  colli: z.array(PackageZ).min(1),

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

  status: string | null;
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

  mittente: PartyInput;

  destinatario: (PartyInput & {
    abilitato_import: boolean | null;
  }) | null;

  fatturazione: PartyInput | null;

  colli_n: number | null;
  peso_reale_kg: number | null;

  packages: Array<{
    id: string;
    peso_reale_kg: number | null;
    lato1_cm: number | null;
    lato2_cm: number | null;
    lato3_cm: number | null;
    contenuto: string | null;
    created_at: string | null;
  }>;

  attachments: Record<string, any> | null;
  extras: Record<string, any> | null;
};
