// app/api/quote-requests/route.ts
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
    console.error("[API/quote-requests] Missing Supabase env", {
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

function jsonError(status: number, error: string, extra?: Record<string, any>) {
  return NextResponse.json(
    { ok: false, error, ...(extra || {}) },
    { status }
  );
}

// ---------- Tipi ----------------------------------------------------

export type QuoteListRow = {
  id: string;
  human_id: string | null;
  created_at: string | null;
  email_cliente: string | null;
  tipo_spedizione: string | null;
  incoterm: string | null;
  status: string | null;

  // ✅ nuovi (per UI lista)
  mittente: any | null;
  destinatario: any | null;
  fields: any | null;
};

// ---------- Handlers ------------------------------------------------

export async function GET(_req: NextRequest) {
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
          "created_at",
          "email_cliente",
          "tipo_spedizione",
          "incoterm",
          "status",
          // ✅ servono per mostrare città/paese e formato
          "mittente",
          "destinatario",
          "fields",
        ].join(", ")
      )
      .order("created_at", { ascending: false })
      .limit(200);

    if (error) {
      console.error("[API/quote-requests:GET] Supabase error", error);
      return jsonError(500, "DB_ERROR", { message: error.message });
    }

    return NextResponse.json(
      {
        ok: true,
        rows: (data || []) as QuoteListRow[],
      },
      { status: 200 }
    );
  } catch (e: any) {
    console.error("[API/quote-requests:GET] ERROR", e?.message || e);
    return jsonError(500, "SERVER_ERROR", { message: e?.message });
  }
}
