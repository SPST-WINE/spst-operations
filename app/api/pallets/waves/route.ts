import { NextResponse } from "next/server";
import { requireStaff } from "@/lib/auth/requireStaff";
import { supabaseServerSpst } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const staffRes = await requireStaff();

  // ✅ Narrowing corretto per StaffAuthResult (ok true/false)
  if (!staffRes.ok) {
    return staffRes.response;
  }

  const body = await req.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "BAD_JSON" }, { status: 400 });
  }

  const {
    shipment_ids,
    planned_pickup_date,
    pickup_window,
    notes,
    carrier_id,
  } = body;

  if (!Array.isArray(shipment_ids) || shipment_ids.length === 0) {
    return NextResponse.json(
      { error: "shipment_ids_required" },
      { status: 400 }
    );
  }
  if (!planned_pickup_date || !carrier_id) {
    return NextResponse.json(
      { error: "planned_pickup_date_and_carrier_id_required" },
      { status: 400 }
    );
  }

  const supabase = supabaseServerSpst();

  const { data, error } = await supabase.rpc("create_pallet_wave", {
    p_shipment_ids: shipment_ids,
    p_planned_pickup_date: planned_pickup_date,
    p_pickup_window: pickup_window ?? null,
    p_notes: notes ?? null,
    p_carrier_id: carrier_id,
    p_created_by: staffRes.userId, // ✅ ora TS è contento
  });

  if (error) {
    if (error.message === "MIN_PALLETS_REQUIRED") {
      return NextResponse.json(
        { error: "MIN_6_PALLETS_REQUIRED" },
        { status: 400 }
      );
    }

    console.error("[POST /api/pallets/waves] DB error:", error);
    return NextResponse.json({ error: "DB_ERROR" }, { status: 500 });
  }

  return NextResponse.json({ wave_id: data });
}
