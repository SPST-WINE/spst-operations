// app/api/spedizioni/[id]/evasa/route.ts
import { NextRequest, NextResponse } from "next/server";
import { requireStaff } from "@/lib/auth/requireStaff";
import { supabaseServerSpst } from "@/lib/supabase/server";
import { ShipmentStatusZ } from "@/lib/contracts/shipment";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

function isUuid(x: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    x
  );
}

export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  // ✅ staff-only
  const staff = await requireStaff();
  if ("response" in staff) return staff.response;

  // ✅ target status
  const targetStatus = ShipmentStatusZ.parse("IN RITIRO");

  const supabase = supabaseServerSpst();

  // 1) Prova update per UUID id
  if (isUuid(params.id)) {
    const { data, error } = await supabase
      .from("shipments")
      .update({ status: targetStatus })
      .eq("id", params.id)
      .select("id, human_id, status")
      .single();

    if (error) {
      return NextResponse.json(
        { ok: false, error: error.message, where: "update_by_id" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      id: data.id,
      human_id: data.human_id,
      status: data.status,
    });
  }

  // 2) Altrimenti, prova update per human_id
  const { data, error } = await supabase
    .from("shipments")
    .update({ status: targetStatus })
    .eq("human_id", params.id)
    .select("id, human_id, status")
    .single();

  if (error) {
    // tipico: "No rows found" / 406 se human_id non esiste
    return NextResponse.json(
      { ok: false, error: error.message, where: "update_by_human_id" },
      { status: 404 }
    );
  }

  return NextResponse.json({
    ok: true,
    id: data.id,
    human_id: data.human_id,
    status: data.status,
  });
}
