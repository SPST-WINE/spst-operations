// app/api/spedizioni/[id]/evasa/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireStaff } from "@/lib/auth/requireStaff";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

function isUuid(x: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    x
  );
}

// ✅ Service Role client (bypassa RLS) — SOLO server-side
function admin() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE ||
    process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) throw new Error("Missing SUPABASE_URL/SERVICE_ROLE");

  return createClient(url, key, { auth: { persistSession: false } }) as any;
}

export async function POST(
  _req: NextRequest,
  ctx: { params: { id: string } }
) {
  const id = ctx.params.id;

  // ✅ auth staff (gestita correttamente)
  const staff = await requireStaff();
  if ("response" in staff) return staff.response;

  if (!id || !isUuid(id)) {
    return NextResponse.json(
      { ok: false, error: "Invalid shipment id" },
      { status: 400 }
    );
  }

  try {
    const sb = admin();

    // ✅ status deve combaciare con il tuo enum: "IN RITIRO"
    const { data, error } = await sb
      .from("shipments")
      .update({ status: "IN RITIRO" })
      .eq("id", id)
      .select("id,status")
      .single();

    if (error) {
      console.error("[api/spedizioni/[id]/evasa] update error", {
        id,
        code: (error as any).code,
        message: error.message,
        details: (error as any).details,
        hint: (error as any).hint,
      });

      return NextResponse.json(
        { ok: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true, shipment: data });
  } catch (e: any) {
    console.error("[api/spedizioni/[id]/evasa] fatal", { id, err: e });
    return NextResponse.json(
      { ok: false, error: e?.message ?? "Internal Server Error" },
      { status: 500 }
    );
  }
}
