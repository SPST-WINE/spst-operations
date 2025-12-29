import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabaseServerSpst } from "@/lib/supabase/server";
import { requireStaff } from "@/lib/auth/requireStaff";
import { ShipmentStatusZ } from "@/lib/contracts/shipment";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

function withCorsHeaders(init?: HeadersInit) {
  return {
    ...(init || {}),
    "Access-Control-Allow-Origin": "*",
  } as Record<string, string>;
}

function admin() {
  const url =
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE ||
    process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) throw new Error("Missing SUPABASE env");

  return createClient(url, key, {
    auth: { persistSession: false },
  }) as any;
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // 🔐 SOLO STAFF
    await requireStaff();

    const shipmentId = params.id;
    if (!shipmentId) {
      return NextResponse.json(
        { ok: false, error: "MISSING_SHIPMENT_ID" },
        { status: 400, headers: withCorsHeaders() }
      );
    }

    const body = await req.json().catch(() => ({}));
    const rawStatus = String(body?.status || "").trim().replace(/\s+/g, " ");
    const note =
      body?.note != null ? String(body.note).slice(0, 2000) : null;

    // ✅ VALIDAZIONE CONTRATTO (Zod)
    let status;
    try {
      status = ShipmentStatusZ.parse(rawStatus);
    } catch {
      return NextResponse.json(
        {
          ok: false,
          error: "INVALID_STATUS",
          allowed: ShipmentStatusZ.options,
        },
        { status: 400, headers: withCorsHeaders() }
      );
    }

    // 👤 chi ha fatto l'update
    let actorEmail: string | null = null;
    try {
      const supa = supabaseServerSpst();
      const { data } = await supa.auth.getUser();
      actorEmail = data?.user?.email
        ? String(data.user.email)
        : null;
    } catch {}

    const sb = admin();

    // 1️⃣ UPDATE shipments.status
    const upd = await sb
      .schema("spst")
      .from("shipments")
      .update({ status })
      .eq("id", shipmentId)
      .select("id,human_id,status,updated_at")
      .single();

    if (upd.error) {
      return NextResponse.json(
        {
          ok: false,
          error: "UPDATE_FAILED",
          details: upd.error.message,
        },
        { status: 500, headers: withCorsHeaders() }
      );
    }

    // 2️⃣ LOG EVENTO STATUS (best-effort)
    try {
      await sb
        .schema("spst")
        .from("shipment_status_events")
        .insert({
          shipment_id: shipmentId,
          status,
          note,
          actor_email: actorEmail,
        });
    } catch (e) {
      console.error(
        "[status] shipment_status_events insert failed (non-blocking)",
        e
      );
    }

    return NextResponse.json(
      { ok: true, shipment: upd.data },
      { headers: withCorsHeaders() }
    );
  } catch (e: any) {
    console.error("❌ PATCH status error:", e?.message || e);

    return NextResponse.json(
      {
        ok: false,
        error: "UNEXPECTED_ERROR",
        details: String(e?.message || e),
      },
      { status: 500, headers: withCorsHeaders() }
    );
  }
}
