// app/api/pallets/waves/list/route.ts
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

  // ✅ la tua env
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

export async function GET() {
  // Se è staff => service role (bypass RLS) e vede tutto
  // Se non è staff => session+RLS (carrier vede solo le sue wave)
  const staffRes: any = await requireStaff();
  const isStaff = !isResponse(staffRes) && staffRes?.ok === true;

  const supabase = isStaff ? getAdminSupabase() : supabaseServerSpst();

  // ✅ Evita "liste vuote silenziose" quando manca la sessione.
  // Se non è staff, deve essere autenticato (carrier session-based).
  if (!isStaff) {
    const {
      data: { user },
    } = await (supabase as any).auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
    }

    // ✅ deve essere un carrier abilitato (altrimenti non ha senso interrogare le wave)
    const { data: cu, error: cuErr } = await (supabase as any)
      .schema("spst")
      .from("carrier_users")
      .select("carrier_id, role, enabled")
      .eq("user_id", user.id)
      .maybeSingle();

    if (cuErr || !cu) {
      return NextResponse.json({ error: "CARRIER_REQUIRED" }, { status: 403 });
    }

    if (cu.enabled === false) {
      return NextResponse.json({ error: "CARRIER_DISABLED" }, { status: 403 });
    }
  }

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
      carriers(name)
    `
    )
    .order("created_at", { ascending: false });

  if (error) {
    console.error(
      `[GET /api/pallets/waves/list] (${isStaff ? "staff" : "carrier"}) DB error:`,
      error
    );
    return NextResponse.json(
      { error: "DB_ERROR", details: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ items: data ?? [] });
}
