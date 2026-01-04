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
  // 1) Se è STAFF → lista completa (admin bypass RLS)
  const staffRes: any = await requireStaff();
  const isStaff = !isResponse(staffRes) && staffRes?.ok === true;

  if (isStaff) {
    try {
      const admin = getAdminSupabase();
      const { data, error } = await admin
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
          carrier_id,
          carriers(name)
        `
        )
        .order("created_at", { ascending: false });

      if (error) {
        console.error("[GET /api/pallets/waves/list] (staff) DB error:", error);
        return NextResponse.json(
          { error: "DB_ERROR", details: error.message },
          { status: 500 }
        );
      }

      return NextResponse.json({ items: data ?? [] });
    } catch (e: any) {
      console.error(
        "[GET /api/pallets/waves/list] (staff) Admin init error:",
        e
      );
      return NextResponse.json(
        { error: "SERVER_MISCONFIG", details: String(e?.message ?? e) },
        { status: 500 }
      );
    }
  }

  // 2) Altrimenti: è CARRIER (o comunque utente non-staff)
  //    → ricava carrier_id da carrier_users e filtra le wave
  const supabase = supabaseServerSpst();

  const {
    data: { user },
    error: userErr,
  } = await supabase.auth.getUser();

  if (userErr) {
    console.error("[GET /api/pallets/waves/list] auth.getUser error:", userErr);
  }
  if (!user) {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  // prendo carrier_id associato all’utente autenticato
  const { data: cu, error: cuErr } = await supabase
    .from("carrier_users")
    .select("carrier_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (cuErr) {
    console.error("[GET /api/pallets/waves/list] carrier_users error:", cuErr);
    return NextResponse.json(
      { error: "DB_ERROR", details: cuErr.message },
      { status: 500 }
    );
  }

  const carrierId = cu?.carrier_id ?? null;
  if (!carrierId) {
    // nessuna associazione → nessuna wave visibile
    return NextResponse.json({ items: [] });
  }

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
      carrier_id,
      carriers(name)
    `
    )
    .eq("carrier_id", carrierId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[GET /api/pallets/waves/list] (carrier) DB error:", error);
    return NextResponse.json(
      { error: "DB_ERROR", details: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ items: data ?? [] });
}
