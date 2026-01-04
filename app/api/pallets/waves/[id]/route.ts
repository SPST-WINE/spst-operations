// app/api/pallets/waves/[id]/route.ts
import { NextResponse } from "next/server";
import { supabaseServerSpst } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const supabase = supabaseServerSpst();

  const { data, error } = await supabase
    .schema("spst")
    .from("pallet_waves")
    .select(
      `
      id,
      code,
      status,
      planned_pickup_date,
      pickup_window,
      notes,
      carriers(name),
      pallet_wave_items(
        id,
        shipment_id,
        shipment_human_id,
        requested_pickup_date,
        planned_pickup_date,
        created_at,
        shipments(
          id,
          human_id,
          formato_sped,
          giorno_ritiro,
          mittente_rs,
          mittente_indirizzo,
          mittente_citta,
          mittente_cap,
          mittente_telefono,
          dest_rs,
          dest_indirizzo,
          dest_citta,
          dest_cap,
          dest_paese,
          dest_telefono,
          ldv
        )
      )
    `
    )
    .eq("id", params.id)
    .single();

  if (error) {
    // NOT FOUND “vero” (row non esiste)
    if (error.code === "PGRST116") {
      return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
    }

    console.error("[GET /api/pallets/waves/:id] DB error:", error);
    return NextResponse.json(
      { error: "DB_ERROR", details: error.message, code: error.code },
      { status: 500 }
    );
  }

  return NextResponse.json({ wave: data });
}
