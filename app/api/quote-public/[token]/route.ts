// app/api/quote-public/[token]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

function makeSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    console.error("[API/quote-public/:token] Missing Supabase env", {
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

export type PublicQuote = {
  id: string;
  human_id: string | null;
  status: string | null;
  created_at: string | null;
  data_ritiro: string | null;
  tipo_spedizione: string | null;
  incoterm: string | null;
  valuta: string | null;
  email_cliente: string | null;
  mittente: any | null;
  destinatario: any | null;
  accepted_option_id: string | null;
};

export type PublicQuoteOption = {
  id: string;
  quote_id: string;
  label: string | null;
  carrier: string | null;
  service_name: string | null;
  transit_time: string | null;
  total_price: number | null;
  currency: string | null;
  public_notes: string | null;
  status: string | null;
};

export async function GET(
  _req: NextRequest,
  context: { params: { token: string } }
) {
  const { token } = context.params;

  if (!token) {
    return jsonError(400, "MISSING_TOKEN");
  }

  const supabase = makeSupabase();
  if (!supabase) {
    return jsonError(500, "NO_SUPABASE_CONFIG");
  }

  try {
    // 1) prendo la quote tramite public_token
    const { data: quote, error: qErr } = await supabase
      .from("quotes")
      .select(
        [
          "id",
          "human_id",
          "status",
          "created_at",
          "data_ritiro",
          "tipo_spedizione",
          "incoterm",
          "valuta",
          "email_cliente",
          "mittente",
          "destinatario",
          "accepted_option_id",
        ].join(", ")
      )
      .eq("public_token", token)
      .single();

    if (qErr) {
      console.error("[API/quote-public/:token:GET] quote error", qErr);
      return jsonError(404, "QUOTE_NOT_FOUND");
    }

    if (!quote) {
      return jsonError(404, "QUOTE_NOT_FOUND");
    }

   // 2) opzioni visibili al cliente
const quoteRow = quote as any; // workaround per i tipi Supabase/TS

const { data: options, error: oErr } = await supabase
  .from("quote_options")
  .select(
    [
      "id",
      "quote_id",
      "label",
      "carrier",
      "service_name",
      "transit_time",
      "total_price",
      "currency",
      "public_notes",
      "status",
    ].join(", ")
  )
  // cast esplicito per evitare l'errore "GenericStringError"
  .eq("quote_id", quoteRow.id)
  .eq("visible_to_client", true)
  .order("total_price", { ascending: true });


    if (oErr) {
      console.error("[API/quote-public/:token:GET] options error", oErr);
      return jsonError(500, "OPTIONS_ERROR", { message: oErr.message });
    }

    return NextResponse.json(
      {
        ok: true,
        quote: quote as unknown as PublicQuote,
        options: (options || []) as unknown as PublicQuoteOption[],
      },
      { status: 200 }
    );
  } catch (e: any) {
    console.error("[API/quote-public/:token:GET] ERROR", e?.message || e);
    return jsonError(500, "SERVER_ERROR", { message: e?.message });
  }
}
