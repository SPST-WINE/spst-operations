// app/api/backoffice/pallets/waves/[id]/status/route.ts
import { NextResponse } from "next/server";
import { requireStaff } from "@/lib/auth/requireStaff";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function getAdminSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Missing SUPABASE_URL/SERVICE_ROLE");
  }

  return createClient(url, key, {
    auth: {
      persistSession: false,
      detectSessionInUrl: false,
    },
  });
}

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  const staffRes: any = await requireStaff();
  if ("response" in staffRes) return staffRes.response;

  if (!staffRes || staffRes.ok !== true) {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  let admin;
  try {
    admin = getAdminSupabase();
  } catch (e: any) {
    console.error("[PATCH /api/backoffice/pallets/waves/:id/status] admin init error:", e);
    return NextResponse.json(
      { error: "SERVER_MISCONFIG", details: String(e?.message ?? e) },
      { status: 500 }
    );
  }

  const { status } = await req.json();

  const { error } = await admin
    .schema("spst")
    .from("pallet_waves")
    .update({ status })
    .eq("id", params.id);

  if (error) {
    console.error("[PATCH /api/backoffice/pallets/waves/:id/status] DB error:", error);
    return NextResponse.json(
      { error: "DB_ERROR", details: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}

