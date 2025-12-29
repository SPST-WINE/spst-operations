// app/api/spedizioni/[id]/evasa/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireStaff } from "@/lib/auth/requireStaff";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

function admin() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE ||
    process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) throw new Error("Missing SUPABASE_URL/SERVICE_ROLE");

  return createClient(url, key, {
    auth: { persistSession: false },
  }) as any;
}

function isUuid(x: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    x
  );
}

export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const staff = await requireStaff();
  if ("response" in staff) return staff.response;

  const id = params.id;
  if (!isUuid(id)) {
    return NextResponse.json(
      { ok: false, error: "Invalid shipment id" },
      { status: 400 }
    );
  }

  try {
    const sb = admin();

    // ✅ sempre disponibile: forza lo status a "IN RITIRO"
    const { data, error } = await sb
      .from("shipments")
      .update({
        status: "IN RITIRO",
        // opzionale: traccia "quando" è partita
        // in_ritiro_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select("id,status,updated_at")
      .single();

    if (error) {
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      id: data.id,
      status: data.status,
      updated_at: data.updated_at ?? null,
    });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message || "Unknown error" },
      { status: 500 }
    );
  }
}
