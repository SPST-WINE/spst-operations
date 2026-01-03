// app/api/backoffice/pallets/waves/route.ts
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

export async function GET() {
  const staffRes: any = await requireStaff();
  if (isResponse(staffRes)) return staffRes;

  if (!staffRes || staffRes.ok !== true) {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  let admin;
  try {
    admin = getAdminSupabase();
  } catch (e: any) {
    console.error("[GET /api/backoffice/pallets/waves] admin init error:", e);
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
      created_at,
      carriers(name)
    `
    )
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[GET /api/backoffice/pallets/waves] DB error:", error);
    return NextResponse.json(
      { error: "DB_ERROR", details: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ items: data ?? [] });
}
