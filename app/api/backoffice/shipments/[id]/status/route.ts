// app/api/backoffice/shipments/[id]/status/route.ts
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import { requireStaff } from "@/lib/auth/requireStaff";
import { ShipmentStatusZ } from "@/lib/contracts/shipment";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const BodyZ = z.object({ status: ShipmentStatusZ });

function withCorsHeaders(init?: HeadersInit) {
  return {
    ...(init || {}),
    "Access-Control-Allow-Origin": "*",
  } as Record<string, string>;
}

export function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "PATCH,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type,Authorization",
      "Access-Control-Max-Age": "86400",
    },
  });
}

function isUuid(x: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    x
  );
}

function admin() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE ||
    process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) throw new Error("Missing SUPABASE_URL/SERVICE_ROLE");
  return createClient(url, key, { auth: { persistSession: false } }) as any;
}

export async function PATCH(req: NextRequest, ctx: { params: { id: string } }) {
  try {
    const staff = await requireStaff();
if (!staff.ok) return staff.response;

    const id = String(ctx?.params?.id || "").trim();
    if (!id || !isUuid(id)) {
      return NextResponse.json(
        { ok: false, error: "INVALID_ID" },
        { status: 400, headers: withCorsHeaders() }
      );
    }

    const raw = await req.json().catch(() => ({}));
    const { status } = BodyZ.parse(raw);

    const supa = admin();

    const { data, error } = await supa
      .schema("spst")
      .from("shipments")
      .update({ status }) // ✅ no updated_at
      .eq("id", id)
      .select("id,human_id,status,created_at,carrier,tracking_code,email_cliente,email_norm")
      .single();

    if (error) {
      return NextResponse.json(
        { ok: false, error: "DB_ERROR", details: error.message },
        { status: 500, headers: withCorsHeaders() }
      );
    }

    return NextResponse.json(
      { ok: true, shipment: data },
      { headers: withCorsHeaders() }
    );
  } catch (e: any) {
    if (e?.name === "ZodError") {
      return NextResponse.json(
        { ok: false, error: "VALIDATION_ERROR", details: e?.errors || e?.message },
        { status: 400, headers: withCorsHeaders() }
      );
    }

    console.error("❌ [backoffice status PATCH] unexpected:", e);
    return NextResponse.json(
      { ok: false, error: "UNEXPECTED_ERROR", details: String(e?.message || e) },
      { status: 500, headers: withCorsHeaders() }
    );
  }
}
