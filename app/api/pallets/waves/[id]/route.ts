import { NextResponse } from "next/server";
import { supabaseServerSpst } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * GET /api/pallets/waves/:id
 * Shared (staff/carrier) via session + RLS.
 *
 * NOTE:
 * - Tables live in schema "spst"
 * - Use maybeSingle(): when 0 rows (RLS or not found) → data=null (no PGRST116)
 */
export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const supabase = supabaseServerSpst();
  const waveId = params.id;

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

          destinatario_ragione_sociale:dest_rs,
          destinatario_indirizzo:dest_indirizzo,
          destinatario_citta:dest_citta,
          destinatario_cap:dest_cap,
          destinatario_paese:dest_paese,
          destinatario_telefono:dest_telefono,

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
    .eq("id", waveId)
    .maybeSingle();

  if (error) {
    console.error("[GET /api/pallets/waves/:id] DB error:", error);
    return NextResponse.json(
      { error: "DB_ERROR", details: error.message },
      { status: 500 }
    );
  }

  // 0 rows (NOT_FOUND or hidden by RLS) → 404 pulito
  if (!data) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }

  return NextResponse.json({ wave: data });
}
