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
  total_weight_real_kg?: string | number | null;
  total_weight_vol_kg?: string | number | null;
  total_weight_tariff_kg?: string | number | null;
  created_at: string;
};

// Supabase admin client che lavora sullo schema PUBLIC (per usare le view)
function getSupabaseAdminPublic() {
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
  });
}

// GET /api/my-shipments
export async function GET() {
  const supabaseAdmin = getSupabaseAdminPublic();
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
    // In futuro qui potremo filtrare per utente loggato.
    const { data, error } = await supabaseAdmin
      .from("v_shipments_detail")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) {
      console.error("[API/my-shipments] select error:", error);
      return NextResponse.json(
        {
          ok: false,
          error: "DB_SELECT_FAILED",
          details: error.message ?? error,
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
