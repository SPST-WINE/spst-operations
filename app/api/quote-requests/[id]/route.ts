// app/api/quote-requests/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "crypto";

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

// payload per PATCH
type QuotePatchPayload = {
  status?: string | null;
  public_token?: string | null;
  generatePublicToken?: boolean;
};

// ---------- GET: dettaglio richiesta --------------------------------

// ---------- GET: dettaglio richiesta --------------------------------

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

    // 🔍 Ricavo i dati da `fields` se le colonne dedicate sono vuote
    const row: any = data;
    const fields = row.fields || {};

    const mittente =
      row.mittente ||
      fields.mittente ||
      fields.mittente_json ||
      null;

    const destinatario =
      row.destinatario ||
      fields.destinatario ||
      fields.destinatario_json ||
      null;

    const colli =
      row.colli ||
      fields.colli ||
      fields.colli_debug ||
      null;

    const quotePayload = {
      ...row,
      mittente,
      destinatario,
      colli,
    } as QuoteDetail;

    return NextResponse.json(
      {
        ok: true,
        quote: quotePayload,
      },
      { status: 200 }
    );
  } catch (e: any) {
    console.error("[API/quote-requests/:id:GET] ERROR", e?.message || e);
    return jsonError(500, "SERVER_ERROR", { message: e?.message });
  }
}

// ---------- PATCH: aggiorna quote (es. genera public_token) ---------

export async function PATCH(
  req: NextRequest,
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

  let body: QuotePatchPayload;
  try {
    body = (await req.json()) as QuotePatchPayload;
  } catch (e: any) {
    console.error("[API/quote-requests/:id:PATCH] Invalid JSON", e);
    return jsonError(400, "INVALID_JSON");
  }

  const updates: Record<string, any> = {
    updated_at: new Date().toISOString(),
  };

  if (typeof body.status === "string") {
    updates.status = body.status;
  }

  let newToken: string | null | undefined = undefined;

  if (body.generatePublicToken) {
    // recupero public_token attuale
    const { data: existing, error: exErr } = await supabase
      .from("quotes")
      .select("public_token")
      .eq("id", id)
      .single();

    if (exErr) {
      console.error("[API/quote-requests/:id:PATCH] load existing error", exErr);
      return jsonError(500, "DB_ERROR", { message: exErr.message });
    }

    if (existing?.public_token) {
      newToken = existing.public_token;
    } else {
      newToken = randomUUID();
    }

    updates.public_token = newToken;
  } else if (
    typeof body.public_token === "string" ||
    body.public_token === null
  ) {
    updates.public_token = body.public_token;
  }

  if (Object.keys(updates).length === 1) {
    // solo updated_at
    return jsonError(400, "NO_FIELDS_TO_UPDATE");
  }

  try {
    const { data, error } = await supabase
      .from("quotes")
      .update(updates)
      .eq("id", id)
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
      .single();

    if (error) {
      console.error("[API/quote-requests/:id:PATCH] DB error", error);
      return jsonError(500, "DB_ERROR", { message: error.message });
    }

    if (!data) {
      return jsonError(404, "NOT_FOUND_AFTER_UPDATE");
    }

    return NextResponse.json(
      {
        ok: true,
        quote: data as unknown as QuoteDetail,
      },
      { status: 200 }
    );
  } catch (e: any) {
    console.error("[API/quote-requests/:id:PATCH] ERROR", e?.message || e);
    return jsonError(500, "SERVER_ERROR", { message: e?.message });
  }
}
