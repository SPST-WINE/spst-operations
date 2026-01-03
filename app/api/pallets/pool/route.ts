import { NextResponse } from "next/server";
import { supabaseServerSpst } from "@/lib/supabase/server";
import { requireStaff } from "@/lib/auth/requireStaff";

export const dynamic = "force-dynamic";

export async function GET() {
  // 🔐 AUTH
  const staff = await requireStaff();
  if (!staff) {
    return NextResponse.json(
      { error: "FORBIDDEN" },
      { status: 403 }
    );
  }

  const supabase = supabaseServerSpst();

  // 🧠 QUERY CANONICA
  // NOTE: Se non tutte le spedizioni eleggibili vengono mostrate, verificare:
  // 1. La funzione get_pallets_pool nel DB non deve avere LIMIT
  // 2. I JOIN con italy_caps e campania_cities_fallback devono essere corretti
  // 3. Verificare che tutti i CAP della Campania siano presenti in italy_caps
  const { data, error } = await supabase.rpc("get_pallets_pool");

  if (error) {
    console.error("[GET /api/pallets/pool] DB error:", error);
    return NextResponse.json(
      { error: "DB_ERROR", details: error.message },
      { status: 500 }
    );
  }

  // Log per debug: verificare che tutte le spedizioni eleggibili siano incluse
  console.log(`[GET /api/pallets/pool] Returned ${data?.length ?? 0} eligible shipments`);

  return NextResponse.json({
    items: data ?? [],
  });
}
