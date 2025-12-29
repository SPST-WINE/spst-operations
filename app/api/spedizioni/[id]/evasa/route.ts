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
    process.env.SUPABASE_SERVICE_ROLE || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing SUPABASE_URL/SERVICE_ROLE");
  return createClient(url, key, { auth: { persistSession: false } }) as any;
}

export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const staff = await requireStaff();
  if ("response" in staff) return staff.response;

  const sb = admin();

  const { data, error } = await sb
    .from("shipments")
    .update({ status: "IN RITIRO" })
    .eq("id", params.id)
    .select("id,status")
    .single();

  if (error) {
    return NextResponse.json(
      { ok: false, error: error.message, id: params.id },
      { status: 400 }
    );
  }

  return NextResponse.json({
    ok: true,
    id: data.id,
    status: data.status, // "IN RITIRO"
  });
}
