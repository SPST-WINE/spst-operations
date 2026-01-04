// app/api/backoffice/pallets/waves/[id]/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireStaff } from "@/lib/auth/requireStaff";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function isResponse(x: any): x is Response {
  return x instanceof Response;
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

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const staffRes: any = await requireStaff();
  if (isResponse(staffRes)) return staffRes;

  if (!staffRes || staffRes.ok !== true) {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  let admin;
  try {
    admin = getAdminSupabase();
  } catch (e: any) {
    console.error("[GET /api/backoffice/pallets/waves/:id] admin init error:", e);
    return NextResponse.json(
      { error: "SERVER_MISCONFIG", details: String(e?.message ?? e) },
      { status: 500 }
    );
  }

  const { data, error } = await admin
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
          declared_value,
          fatt_valuta,
          ldv,
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
    if (error.code === "PGRST116") {
      return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
    }

    console.error("[GET /api/backoffice/pallets/waves/:id] DB error:", error);
    return NextResponse.json(
      { error: "DB_ERROR", details: error.message, code: error.code },
      { status: 500 }
    );
  }

  return NextResponse.json({ wave: data });
}
