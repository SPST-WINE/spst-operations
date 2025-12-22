// lib/mappers/shipment.mapper.ts
import { ShipmentDTO } from "@/lib/contracts/shipment";

export function mapShipmentRowToDTO(
  row: any,
  packages: any[] = []
): ShipmentDTO {
  return {
    id: row.id,
    human_id: row.human_id,
    created_at: row.created_at,

    customer_id: row.customer_id,
    email_cliente: row.email_cliente,

    status: row.status,
    carrier: row.carrier,
    service_code: row.service_code,
    tracking_code: row.tracking_code,

    tipo_spedizione: row.tipo_spedizione,
    incoterm: row.incoterm,
    declared_value: row.declared_value,
    fatt_valuta: row.fatt_valuta,

    giorno_ritiro: row.giorno_ritiro,
    pickup_at: row.pickup_at,
    note_ritiro: row.note_ritiro,

    formato_sped: row.formato_sped,
    contenuto_generale: row.contenuto_generale,

    mittente: {
      rs: row.mittente_rs,
      referente: row.mittente_referente,
      telefono: row.mittente_telefono,
      piva: row.mittente_piva,
      paese: row.mittente_paese,
      citta: row.mittente_citta,
      cap: row.mittente_cap,
      indirizzo: row.mittente_indirizzo,
    },

    destinatario: row.dest_rs
      ? {
          rs: row.dest_rs,
          referente: row.dest_referente,
          telefono: row.dest_telefono,
          piva: row.dest_piva,
          paese: row.dest_paese,
          citta: row.dest_citta,
          cap: row.dest_cap,
          indirizzo: row.dest_indirizzo,
          abilitato_import: row.dest_abilitato_import,
        }
      : null,

    fatturazione: row.fatt_rs
      ? {
          rs: row.fatt_rs,
          referente: row.fatt_referente,
          telefono: row.fatt_telefono,
          piva: row.fatt_piva,
          paese: row.fatt_paese,
          citta: row.fatt_citta,
          cap: row.fatt_cap,
          indirizzo: row.fatt_indirizzo,
        }
      : null,

    colli_n: row.colli_n,
    peso_reale_kg: row.peso_reale_kg,

    packages,

    attachments: {
      ldv: row.ldv,
      fattura_proforma: row.fattura_proforma,
      fattura_commerciale: row.fattura_commerciale,
      dle: row.dle,
      allegato1: row.allegato1,
      allegato2: row.allegato2,
      allegato3: row.allegato3,
      allegato4: row.allegato4,
    },

    extras: row.fields ?? null,
  };
}
