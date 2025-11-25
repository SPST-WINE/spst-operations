// app/api/quote-requests/[id]/route.ts
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
    console.error("[API/quote-requests/:id] Missing Supabase env", {
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
  data_ritiro: string | null; // date
  tipo_spedizione: string | null;
  valuta: string | null;
  note_generiche: string | null;
  mittente: any | null;
  destinatario: any | null;
  colli: any | null;
  public_token: string | null;
  accepted_option_id: string | null;
  updated_at: string | null;
  fields: any; // JSON originale con tutti i dati salvati finora
};

// ---------- Handler -------------------------------------------------

export async function GET(
  _req: NextRequest,
  context: { params: { id: string } }
) {
  const { id } = context.params;

  if (!id) {
    return jsonError(400, "MISSING_ID");
  }

  const supabase = makeSupabase();
  if (!supabase) {
    return jsonError(500, "NO_SUPABASE_CONFIG");
  }

  try {
    const { data, error } = await supabase
      .from("quotes")
      .select(
        [
          "id",
          "human_id",
          "status",
          "declared_value",
          "incoterm",
          "created_at",
          "origin",
          "email_cliente",
          "creato_da_email",
          "data_ritiro",
          "tipo_spedizione",
          "valuta",
          "note_generiche",
          "mittente",
          "destinatario",
          "colli",
          "public_token",
          "accepted_option_id",
          "updated_at",
          "fields",
        ].join(", ")
      )
      .eq("id", id)
      .single();

    if (error) {
      console.error("[API/quote-requests/:id:GET] DB error", error);
      return jsonError(500, "DB_ERROR", { message: error.message });
    }

    if (!data) {
      return jsonError(404, "NOT_FOUND");
    }

        return NextResponse.json(
      {
        ok: true,
        quote: data as unknown as QuoteDetail,
      },
      { status: 200 }
    );
  } catch (e: any) {
    console.error("[API/quote-requests/:id:GET] ERROR", e?.message || e);
    return jsonError(500, "SERVER_ERROR", { message: e?.message });
  }
}
