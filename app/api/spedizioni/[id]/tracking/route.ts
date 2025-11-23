// app/api/spedizioni/[id]/tracking/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: { id: string } };

export async function PATCH(req: Request, { params }: Params) {
  try {
    const shipmentId = params.id;
    if (!shipmentId) {
      return NextResponse.json(
        { ok: false, error: "Missing shipment id" },
        { status: 400 }
      );
    }

    const body = await req.json().catch(() => ({} as any));
    const patch: Record<string, any> = {};

    if (typeof body.carrier === "string") {
      patch.carrier = body.carrier.trim() || null;
    }
    if (typeof body.tracking_code === "string") {
      patch.tracking_code = body.tracking_code.trim() || null;
    }
    if (typeof body.status === "string") {
      patch.status = body.status.trim();
    }

    if (Object.keys(patch).length === 0) {
      return NextResponse.json(
        { ok: false, error: "EMPTY_PATCH" },
        { status: 400 }
      );
    }

    const SUPABASE_URL =
      process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
    const SERVICE_ROLE =
      process.env.SUPABASE_SERVICE_ROLE || process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!SUPABASE_URL || !SERVICE_ROLE) {
      return NextResponse.json(
        { ok: false, error: "Missing Supabase env" },
        { status: 500 }
      );
    }

    const supa = createClient(SUPABASE_URL, SERVICE_ROLE, {
      auth: { persistSession: false },
    }) as any;

    const { error } = await supa
      .schema("spst")
      .from("shipments")
      .update(patch)
      .eq("id", shipmentId);

    if (error) {
      console.error("[tracking] update error:", error);
      return NextResponse.json(
        { ok: false, error: error.message || "DB update failed" },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error("[tracking] unexpected:", e);
    return NextResponse.json(
      { ok: false, error: String(e?.message || e) },
      { status: 500 }
    );
  }
}
