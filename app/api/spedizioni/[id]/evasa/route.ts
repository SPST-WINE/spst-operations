// app/api/spedizioni/[id]/evasa/route.ts
import { NextRequest, NextResponse } from "next/server";
import { supabaseServerSpst } from "@/lib/supabase/server";
import { requireStaff } from "@/lib/auth/requireStaff";

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
  ctx: { params: { id: string } }
) {
  const id = ctx.params.id;

  try {
    // ✅ auth staff
    await requireStaff();

    if (!id || !isUuid(id)) {
      return NextResponse.json(
        { ok: false, error: "Invalid shipment id" },
        { status: 400 }
      );
    }

    const sb = supabaseServerSpst();

    // ✅ update status — IMPORTANT: niente updated_at in select
    const { data, error } = await sb
      .from("shipments")
      .update({ status: "IN_RITIRO" })
      .eq("id", id)
      .select("id, status") // <-- NON mettere updated_at qui
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
