// app/api/pallets/waves/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireStaff } from "@/lib/auth/requireStaff";
import { supabaseServerSpst } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

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

function getAdminSupabase() {
  const url =
    process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "";

  const service =
    process.env.SUPABASE_SERVICE_ROLE ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    "";

  if (!url || !service) {
    throw new Error(
      "Missing SUPABASE_SERVICE_ROLE (or SUPABASE_SERVICE_ROLE_KEY) and SUPABASE_URL/NEXT_PUBLIC_SUPABASE_URL"
    );
  }

  return createClient(url, service, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}

/**
 * GET /api/pallets/waves
 * Shared (staff/carrier) via session + RLS.
 * - Carrier: vede solo le proprie wave via RLS (carrier_users)
 *
 * ⚠️ Non usare service role qui, altrimenti il carrier vedrebbe tutte le wave.
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

  if (isResponse(staffRes)) return staffRes;

  if (!staffRes || staffRes.ok !== true) {
    if (staffRes?.response && isResponse(staffRes.response)) return staffRes.response;
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

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

  let admin;
  try {
    admin = getAdminSupabase();
  } catch (e: any) {
    console.error("[POST /api/pallets/waves] Admin client init error:", e);
    return NextResponse.json(
      { error: "SERVER_MISCONFIG", details: String(e?.message ?? e) },
      { status: 500 }
    );
  }

  // ✅ IMPORTANT: RPC nello schema spst (non public)
  const { data, error } = await admin.schema("spst").rpc("create_pallet_wave", {
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
    return NextResponse.json(
      { error: "DB_ERROR", details: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ wave_id: data });
}
