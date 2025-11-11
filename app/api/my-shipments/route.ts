import { NextResponse } from "next/server";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

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

let cachedClient: SupabaseClient<any, any> | null = null;

function getSupabaseServiceClient(): SupabaseClient<any, any> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE || process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error("SUPABASE_ADMIN_MISCONFIG: missing url or service key");
  }

  if (!cachedClient) {
    cachedClient = createClient<any, any>(url, key, {
      db: { schema: "spst" },
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }

  return cachedClient;
}

// GET /api/my-shipments
export async function GET() {
  try {
    const supabase = getSupabaseServiceClient();

    const { data, error } = await supabase
      .from("shipments")
      .select(
        [
          "id",
          "human_id",
          "tipo_spedizione",
          "incoterm",
          "mittente_citta",
          "dest_citta",
          "giorno_ritiro",
          "colli_n",
          "peso_reale_kg",
          "created_at",
        ].join(",")
      )
      .order("created_at", { ascending: false })
      .limit(200);

    if (error) {
      console.error("[API/my-shipments] select error:", error);
      return NextResponse.json(
        { ok: false, error: "DB_SELECT_FAILED", details: error.message },
        { status: 500 }
      );
    }

    const rows = (data ?? []) as unknown as ShipmentRow[];

    return NextResponse.json(
      {
        ok: true,
        rows,
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
