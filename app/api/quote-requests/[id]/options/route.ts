// app/api/quote-requests/[id]/options/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

// ---------- Helpers -------------------------------------------------

function makeSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    console.error("[API/quote-requests/:id/options] Missing Supabase env", {
      hasUrl: !!url,
      hasKey: !!key,
    });
    return null;
  }

  return createClient(url, key, {
    auth: { persistSession: false },
    db: { schema: "spst" },
  });
}

function jsonError(
  status: number,
  error: string,
  extra?: Record<string, any>
) {
  return NextResponse.json(
    {
      ok: false,
      error,
      ...(extra || {}),
    },
    { status }
  );
}

// ---------- Tipi ----------------------------------------------------

export type QuoteOptionPayload = {
  optionId?: string | null; // se presente -> update, altrimenti insert

  label?: string | null; // "Opzione A", "Opzione B", ecc.
  carrier?: string | null;
  service_name?: string | null;
  transit_time?: string | null;

  freight_price?: number | null;
  customs_price?: number | null;
  extras?: { label: string; amount: number }[] | null;
  total_price?: number | null;
  currency?: string | null;

  public_notes?: string | null;
  visible_to_client?: boolean | null;

  internal_cost?: number | null;
  internal_profit?: number | null;
  internal_notes?: string | null;

  status?: string | null; // bozza / inviata / vista / accettata / rifiutata / scaduta
};

// ---------- Handler -------------------------------------------------

export async function POST(
  req: NextRequest,
  context: { params: { id: string } }
) {
  const { id: quoteId } = context.params;

  if (!quoteId) {
    return jsonError(400, "MISSING_QUOTE_ID");
  }

  const supabase = makeSupabase();
  if (!supabase) {
    return jsonError(500, "NO_SUPABASE_CONFIG");
  }

  let body: QuoteOptionPayload;
  try {
    body = (await req.json()) as QuoteOptionPayload;
  } catch (e: any) {
    console.error("[API/quote-requests/:id/options:POST] Invalid JSON", e);
    return jsonError(400, "INVALID_JSON");
  }

  // estraggo i campi con default sensati
  const {
    optionId,

    label,
    carrier,
    service_name,
    transit_time,

    freight_price,
    customs_price,
    extras,
    total_price,
    currency,

    public_notes,
    visible_to_client,

    internal_cost,
    internal_profit,
    internal_notes,

    status,
  } = body;

  // calcolo totale se non passato, usando freight + customs + extras
  let computedTotal = total_price ?? null;
  const freight = freight_price ?? 0;
  const customs = customs_price ?? 0;
  const extrasTotal =
    (extras || []).reduce((sum, e) => sum + (Number(e.amount) || 0), 0) || 0;

  if (computedTotal === null && (freight || customs || extrasTotal)) {
    computedTotal = freight + customs + extrasTotal;
  }

  // payload comune per insert/update
  const payload: Record<string, any> = {
    quote_id: quoteId,
    label: label ?? null,
    carrier: carrier ?? null,
    service_name: service_name ?? null,
    transit_time: transit_time ?? null,
    freight_price: freight_price ?? null,
    customs_price: customs_price ?? null,
    extras: extras ?? null,
    total_price: computedTotal,
    currency: currency ?? "EUR",
    public_notes: public_notes ?? null,
    visible_to_client:
      typeof visible_to_client === "boolean" ? visible_to_client : true,
    internal_cost: internal_cost ?? null,
    internal_profit: internal_profit ?? null,
    internal_notes: internal_notes ?? null,
    status: status ?? "bozza",
    updated_at: new Date().toISOString(),
  };

  try {
    // prima mi assicuro che la quote esista
    const { data: quoteRow, error: quoteErr } = await supabase
      .from("quotes")
      .select("id")
      .eq("id", quoteId)
      .single();

    if (quoteErr || !quoteRow) {
      console.error(
        "[API/quote-requests/:id/options:POST] Quote not found",
        quoteErr
      );
      return jsonError(404, "QUOTE_NOT_FOUND");
    }

    let result;
    if (optionId) {
      // UPDATE di una opzione esistente
      const { data, error } = await supabase
        .from("quote_options")
        .update(payload)
        .eq("id", optionId)
        .eq("quote_id", quoteId)
        .select("*")
        .single();

      if (error) {
        console.error(
          "[API/quote-requests/:id/options:POST] UPDATE error",
          error
        );
        return jsonError(500, "DB_UPDATE_ERROR", { message: error.message });
      }

      result = data;
    } else {
      // INSERT di una nuova opzione
      const { data, error } = await supabase
        .from("quote_options")
        .insert({
          ...payload,
          created_at: new Date().toISOString(),
        })
        .select("*")
        .single();

      if (error) {
        console.error(
          "[API/quote-requests/:id/options:POST] INSERT error",
          error
        );
        return jsonError(500, "DB_INSERT_ERROR", { message: error.message });
      }

      result = data;
    }

    return NextResponse.json(
      {
        ok: true,
        option: result as unknown, // se vuoi puoi tipizzare come QuoteOptionRow
      },
      { status: 200 }
    );
  } catch (e: any) {
    console.error("[API/quote-requests/:id/options:POST] ERROR", e?.message);
    return jsonError(500, "SERVER_ERROR", { message: e?.message });
  }
}
