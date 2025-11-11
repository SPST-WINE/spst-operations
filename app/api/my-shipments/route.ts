import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

type ShipmentRow = {
  id: string;
  human_id: string | null;
  tipo_spedizione: string | null;
  incoterm: string | null;
  mittente_citta: string | null;
  dest_citta: string | null;
  giorno_ritiro: string | null;
  colli_n: number | null;
  peso_reale_kg: string | number | null;
  created_at: string;
};

// Supabase admin client sullo schema "spst" (come in /api/spedizioni)
function getSupabaseAdminSpst() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE;

  if (!url || !key) {
    console.warn("[API/my-shipments] Supabase env mancanti:", {
      url: !!url,
      key: !!key,
    });
    return null;
  }

  return createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    db: {
      schema: "spst",
    },
  });
}

// GET /api/my-shipments
export async function GET() {
  const supabaseAdmin = getSupabaseAdminSpst();
  if (!supabaseAdmin) {
    return NextResponse.json(
      {
        ok: false,
        error: "NO_SUPABASE_ADMIN",
      },
      { status: 500 }
    );
  }

  try {
    // In futuro qui filtreremo per utente loggato (customer_id).
    const { data, error } = await supabaseAdmin
      .from("shipments")
      .select(
        "id, human_id, tipo_spedizione, incoterm, mittente_citta, dest_citta, giorno_ritiro, colli_n, peso_reale_kg, created_at"
      )
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) {
      console.error("[API/my-shipments] select error:", error);
      return NextResponse.json(
        {
          ok: false,
          error: "DB_SELECT_FAILED",
          details: error.message ?? String(error),
        },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        ok: true,
        data: (data ?? []) as ShipmentRow[],
      },
      { status: 200 }
    );
  } catch (e: any) {
    console.error("[API/my-shipments] unexpected error:", e);
    return NextResponse.json(
      {
        ok: false,
        error: "UNEXPECTED_ERROR",
        details: e?.message ?? String(e),
      },
      { status: 500 }
    );
  }
}
