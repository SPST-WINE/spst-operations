import { NextResponse } from "next/server";
import { supabaseServerSpst } from "@/lib/supabase/server";

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const supabase = supabaseServerSpst();

  const { data, error } = await supabase
    .from("pallet_waves")
    .select(`
      id,
      code,
      status,
      planned_pickup_date,
      pickup_window,
      notes,
      carriers(name),
      pallet_wave_items(
        shipment_id,
        shipment_human_id,
        requested_pickup_date,
        planned_pickup_date,
        shipments(
          mittente_ragione_sociale,
          mittente_indirizzo,
          mittente_citta,
          mittente_cap,
          mittente_telefono,
          destinatario_ragione_sociale,
          destinatario_citta,
          destinatario_paese,
          ldv
        )
      )
    `)
    .eq("id", params.id)
    .single();

  if (error) {
    console.error("[GET /api/pallets/waves/:id]", error);
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }

  return NextResponse.json({ wave: data });
}
