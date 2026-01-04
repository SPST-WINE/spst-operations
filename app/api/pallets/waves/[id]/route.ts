// app/api/pallets/waves/[id]/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabaseServerSpst } from "@/lib/supabase/server";
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
  // Staff => service role (bypass RLS)
  // Carrier => session + RLS
  const staffRes: any = await requireStaff();
  const isStaff = !isResponse(staffRes) && staffRes?.ok === true;

  const supabase = isStaff ? getAdminSupabase() : supabaseServerSpst();

  // ⚠️ IMPORTANTISSIMO: schema spst
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
          mittente,
          mittente_indirizzo,
          mittente_citta,
          mittente_cap,
          mittente_telefono,
          destinatario,
          destinatario_citta,
          destinatario_paese,
          ldv,
          note_ritiro
        )
      )
    `
    )
    .eq("id", params.id)
    .single();

  if (error) {
    console.error(
      `[GET /api/pallets/waves/:id] (${isStaff ? "staff" : "carrier"}) DB error:`,
      error
    );

    // Se carrier non ha accesso (RLS) o non esiste: 404 pulito
    return NextResponse.json(
      { error: "NOT_FOUND" },
      { status: 404 }
    );
  }

  return NextResponse.json({ wave: data });
}
