// app/api/utility-documenti/genera/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function envOrThrow(name: string): string {
  const v = process.env[name];
  if (!v || v.trim() === "") {
    throw new Error(`Missing env ${name}`);
  }
  return v;
}

function admin() {
  const url = envOrThrow("NEXT_PUBLIC_SUPABASE_URL");
  const key =
    process.env.SUPABASE_SERVICE_ROLE ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    envOrThrow("SUPABASE_SERVICE_ROLE");
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  }) as any;
}

const ALLOWED_DOC_TYPES = new Set([
  "ddt",
  "fattura_proforma",
  "fattura_commerciale",
  "dle",
]);

// POST /api/utility-documenti/genera
// body: { human_id, doc_type, courier, tracking_code }
export async function POST(req: Request) {
  let body: any = {};
  try {
    body = await req.json();
  } catch {}

  const humanId = (body?.human_id || "").trim();
  const docType = (body?.doc_type || "").trim();
  const courier = (body?.courier || "").trim();
  const trackingCode = (body?.tracking_code || "").trim() || null;

  if (!humanId) {
    return NextResponse.json(
      { ok: false, error: "MISSING_HUMAN_ID" },
      { status: 400 }
    );
  }
  if (!ALLOWED_DOC_TYPES.has(docType)) {
    return NextResponse.json(
      { ok: false, error: "INVALID_DOC_TYPE" },
      { status: 400 }
    );
  }
  if (!courier) {
    return NextResponse.json(
      { ok: false, error: "MISSING_COURIER" },
      { status: 400 }
    );
  }

  try {
    const supa = admin();

    // 1) Spedizione
    const {
      data: shipment,
      error: shipmentErr,
    } = await supa
      .schema("spst")
      .from("shipments")
      .select("*")
      .eq("human_id", humanId)
      .single();

    if (shipmentErr || !shipment) {
      console.error(
        "[utility-documenti:genera] shipment select error:",
        shipmentErr?.message
      );
      return NextResponse.json(
        { ok: false, error: "SHIPMENT_NOT_FOUND" },
        { status: 404 }
      );
    }

    const shipmentId = shipment.id as string;

    // 2) Colli
    const { data: packages, error: pkgErr } = await supa
      .schema("spst")
      .from("packages")
      .select("*")
      .eq("shipment_id", shipmentId);

    if (pkgErr) {
      console.error("[utility-documenti:genera] packages select error:", pkgErr);
    }

    // 3) Packing list
    const { data: plLines, error: plErr } = await supa
      .schema("spst")
      .from("shipment_pl_lines")
      .select("*")
      .eq("shipment_id", shipmentId);

    if (plErr) {
      console.error(
        "[utility-documenti:genera] pl_lines select error:",
        plErr
      );
    }

    const doc = {
      meta: {
        humanId,
        docType,
        courier,
        trackingCode,
        createdAt: new Date().toISOString(),
      },
      shipment,
      packages: packages || [],
      packingList: plLines || [],
    };

    return NextResponse.json({ ok: true, doc });
  } catch (e: any) {
    console.error("[utility-documenti:genera] unexpected error:", e);
    return NextResponse.json(
      { ok: false, error: "UNEXPECTED_ERROR", details: String(e?.message || e) },
      { status: 500 }
    );
  }
}
