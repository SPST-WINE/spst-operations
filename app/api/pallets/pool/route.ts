// app/api/pallets/pool/route.ts
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

  // ✅ priorità: SUPABASE_SERVICE_ROLE (la tua)
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
  // 🔐 AUTH (staff-only)
  const staffRes: any = await requireStaff();

  if (isResponse(staffRes)) return staffRes;

  if (!staffRes || staffRes.ok !== true) {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  // ✅ service role (bypass RLS)
  let supabase;
  try {
    supabase = getAdminSupabase();
  } catch (e: any) {
    console.error("[GET /api/pallets/pool] Admin client init error:", e);
    return NextResponse.json(
      { error: "SERVER_MISCONFIG", details: String(e?.message ?? e) },
      { status: 500 }
    );
  }

  // ✅ IMPORTANT: la funzione è in schema spst, non public
  const { data, error } = await supabase.schema("spst").rpc("get_pallets_pool");

  if (error) {
    console.error("[GET /api/pallets/pool] DB error:", error);
    return NextResponse.json(
      { error: "DB_ERROR", details: error.message },
      { status: 500 }
    );
  }

  console.log(
    `[GET /api/pallets/pool] Returned ${data?.length ?? 0} eligible shipments`
  );

  return NextResponse.json({ items: data ?? [] });
}
