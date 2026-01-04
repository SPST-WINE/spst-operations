import { NextResponse } from "next/server";
import { supabaseServerSpst } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * GET /api/pallets/waves/:id
 * Shared (staff/carrier) via session + RLS.
 *
 * Canonical response fields (UI):
 * - shipments.mittente_ragione_sociale
 * - shipments.destinatario_ragione_sociale
 * - shipments.mittente_telefono
 * - shipments.ldv
 * - shipments.note_ritiro
 *
 * DB fields (current):
 * - shipments.mittente_rs / destinatario_rs (hint 42703)
 */
export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const supabase = supabaseServerSpst();

  const { data, error } = await supabase
    .from("pallet_waves")
    .select(
      `
      id,
      code,
      status,
      planned_pickup_date,
      pickup_window,
      notes,
      created_at,
      carriers(name),
      pallet_wave_items(
        shipment_id,
        shipment_human_id,
        requested_pickup_date,
        planned_pickup_date,
        shipments(
          mittente_ragione_sociale:mittente_rs,
          mittente_indirizzo,
          mittente_citta,
          mittente_cap,
          mittente_telefono,
          destinatario_ragione_sociale:destinatario_rs,
          destinatario_indirizzo,
          destinatario_citta,
          destinatario_cap,
          destinatario_paese,
          destinatario_telefono,
          declared_value,
          fatt_valuta,
          ldv,
          note_ritiro,
          packages:packages!packages_shipment_id_fkey(
            id,
            length_cm,
            width_cm,
            height_cm,
            weight_kg,
            contenuto
          )
        )
      )
    `
    )
    .eq("id", params.id)
    .single();

  if (error) {
    console.error("[GET /api/pallets/waves/:id] DB error:", error);

    // Not found / RLS denies → 404
    // (PostgREST usa spesso PGRST116 per .single() con 0 righe)
    const msg = String(error.message ?? "");
    if (error.code === "PGRST116" || msg.toLowerCase().includes("0 rows")) {
      return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
    }

    return NextResponse.json(
      { error: "DB_ERROR", details: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ wave: data });
}
