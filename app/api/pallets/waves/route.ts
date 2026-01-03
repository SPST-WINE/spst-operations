import { NextResponse } from "next/server";
import { requireStaff } from "@/lib/auth/requireStaff";
import { supabaseServerSpst } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

function isResponse(x: any): x is Response {
  return x instanceof Response;
}

function getStaffUserId(x: any): string | null {
  // supporta le varianti possibili:
  // - { ok:true, userId: ... }
  // - { ok:true, id: ... }
  // - { ok:true, user: { id: ... } }
  if (!x || x.ok !== true) return null;
  if (typeof x.userId === "string") return x.userId;
  if (typeof x.id === "string") return x.id;
  if (x.user && typeof x.user.id === "string") return x.user.id;
  return null;
}

/**
 * GET /api/pallets/waves
 * Shared (staff/carrier).
 * - Staff: vede tutto se policy lo consente
 * - Carrier: vede solo le proprie wave via RLS (carrier_users)
 *
 * NB: manteniamo anche /api/pallets/waves/list per retro-compatibilità.
 */
export async function GET() {
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
      carriers(name)
    `
    )
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[GET /api/pallets/waves]", error);
    return NextResponse.json({ error: "DB_ERROR" }, { status: 500 });
  }

  return NextResponse.json({ items: data ?? [] });
}

export async function POST(req: Request) {
  const staffRes: any = await requireStaff();

  // Caso A: requireStaff() ritorna direttamente una Response/NextResponse
  if (isResponse(staffRes)) {
    return staffRes;
  }

  // Caso B: ritorna un oggetto con ok=false (ma senza "response" tipizzata)
  if (!staffRes || staffRes.ok !== true) {
    // Se esiste una response interna, la usiamo (runtime safe)
    if (staffRes?.response && isResponse(staffRes.response)) {
      return staffRes.response;
    }
    // fallback duro e pulito
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  // Caso C: ok=true
  const createdBy = getStaffUserId(staffRes);
  if (!createdBy) {
    return NextResponse.json(
      { error: "STAFF_AUTH_MISSING_USER_ID" },
      { status: 500 }
    );
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
    p_created_by: createdBy,
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
