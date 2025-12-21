// components/backoffice/quote-detail/types.ts

export type Props = {
  id: string;
};

export type QuoteDetail = {
  id: string;
  human_id: string | null;
  status: string | null;
  declared_value: number | null;
  incoterm: string | null;
  created_at: string | null;
  origin: string | null;
  email_cliente: string | null;
  creato_da_email: string | null;
  data_ritiro: string | null;
  tipo_spedizione: string | null;
  valuta: string | null;
  note_generiche: string | null;
  mittente: any | null;
  destinatario: any | null;
  colli: any | null;
  contenuto_colli?: string | null; // ✅ colonna canonica
  public_token: string | null;
  accepted_option_id: string | null;
  updated_at: string | null;
  fields: any;
};

export type QuoteOptionRow = {
  id: string;
  quote_id: string;
  label: string | null;
  carrier: string | null;
  service_name: string | null;
  transit_time?: string | null;
  freight_price?: number | null;
  customs_price?: number | null;
  total_price: number | null;
  currency: string | null;
  internal_cost: number | null;
  internal_profit: number | null;
  status: string | null;
  sent_at: string | null;
  created_at: string | null;
  visible_to_client?: boolean | null;
};

export type ParsedColli = {
  rows: {
    i: number;
    qty: number;
    dims: string;
    peso: number | string;
  }[];
  totalQty: number;
  totalWeight: number;
};
