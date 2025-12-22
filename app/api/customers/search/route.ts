// app/api/customers/search/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireStaff } from "@/lib/auth/requireStaff";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

function makeSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE;

  if (!url || !key) return null;

  return createClient(url, key, {
    auth: { persistSession: false },
  });
}

export async function GET(req: NextRequest) {
  const staff = await requireStaff();
  if ("response" in staff) return staff.response;

  try {
    const supabase = makeSupabase();
    if (!supabase) {
      return NextResponse.json(
        { ok: false, error: "MISSING_SUPABASE_ENV" },
        { status: 500 }
      );
    }

    const { searchParams } = new URL(req.url);
    const qRaw = (searchParams.get("q") || "").trim();
    const limitRaw = searchParams.get("limit");
    const limit = Math.min(Math.max(parseInt(limitRaw || "10", 10) || 10, 1), 50);

    let query = supabase
      .schema("spst")
      .from("customers")
      .select("id,email,company_name,name,phone,vat_number")
      .order("created_at", { ascending: false })
      .limit(limit);

    if (qRaw) {
      const safe = qRaw.replace(/[%_]/g, "");
      const pattern = `%${safe}%`;
      query = query.or(
        `email.ilike.${pattern},company_name.ilike.${pattern},name.ilike.${pattern}`
      );
    }

    const { data, error } = await query;

    if (error) {
      console.error("[API/customers/search] error:", error.message);
      return NextResponse.json(
        { ok: false, error: "DB_ERROR", details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      customers: data ?? [],
    });
  } catch (e: any) {
    console.error("[API/customers/search] fatal:", e);
    return NextResponse.json(
      { ok: false, error: "SERVER_ERROR", details: e?.message || String(e) },
      { status: 500 }
    );
  }
}
