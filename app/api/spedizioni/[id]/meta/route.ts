// app/api/spedizioni/[id]/meta/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabaseServerSpst } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

function admin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing SUPABASE_URL/SERVICE_ROLE");
  return createClient(url, key, { auth: { persistSession: false } }) as any;
}

async function isStaff(): Promise<boolean> {
  const supa = supabaseServerSpst();
  const { data } = await supa.auth.getUser();
  const user = data?.user;
  if (!user?.id || !user?.email) return false;
  const email = user.email.toLowerCase().trim();
  if (email === "info@spst.it") return true;

  const { data: staff } = await supa
    .from("staff_users")
    .select("role, enabled")
    .eq("user_id", user.id)
    .maybeSingle();

  const enabled =
    typeof (staff as any)?.enabled === "boolean" ? (staff as any).enabled : true;

  const role = String((staff as any)?.role || "").toLowerCase().trim();
  return enabled && (role === "admin" || role === "staff" || role === "operator");
}

export async function OPTIONS() {
  return NextResponse.json(
    { ok: true },
    {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET,OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      },
    }
  );
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const id = params.id;
  if (!id) return NextResponse.json({ ok: false, error: "MISSING_ID" }, { status: 400 });

  const supa = supabaseServerSpst();
  const {
    data: { user },
  } = await supa.auth.getUser();

  if (!user?.id) {
    return NextResponse.json({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });
  }

  const staff = await isStaff();

  try {
    if (staff) {
      const supaAdmin = admin();
      const { data, error } = await supaAdmin
        .schema("spst")
        .from("shipments")
        .select("id,human_id,status,carrier,tracking_code,created_at")
        .eq("id", id)
        .single();

      if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
      return NextResponse.json({ ok: true, meta: data, scope: "staff" });
    }

    const { data, error } = await supa
      .from("shipments")
      .select("id,human_id,status,carrier,tracking_code,created_at")
      .eq("id", id)
      .single();

    if (error) return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404 });
    return NextResponse.json({ ok: true, meta: data, scope: "client" });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: "SERVER_ERROR", details: String(e?.message || e) },
      { status: 500 }
    );
  }
}
