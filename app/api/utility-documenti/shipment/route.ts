// app/api/utility-documenti/shipment/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

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

// GET /api/utility-documenti/shipment?human_id=SP-...
export async function GET(req: Request) {
  const url = new URL(req.url);
  const humanId = (url.searchParams.get("human_id") || "").trim();

  if (!humanId) {
    return NextResponse.json(
      { ok: false, error: "MISSING_HUMAN_ID" },
      { status: 400 }
    );
  }

  try {
    const supa = admin();

    // 1) Trova la spedizione per human_id
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
        "[utility-documenti] shipment select error:",
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
      .eq("shipment_id", shipmentId)
      .order("idx", { ascending: true });

    if (pkgErr) {
      console.error("[utility-documenti] packages select error:", pkgErr);
    }

    // 3) Packing list (righe)
    const { data: plLines, error: plErr } = await supa
      .schema("spst")
      .from("shipment_pl_lines")
      .select("*")
      .eq("shipment_id", shipmentId)
      .order("line_no", { ascending: true });

    if (plErr) {
      console.error("[utility-documenti] pl_lines select error:", plErr);
    }

    return NextResponse.json({
      ok: true,
      shipment,
      packages: packages || [],
      plLines: plLines || [],
    });
  } catch (e: any) {
    console.error("[utility-documenti] unexpected error:", e);
    return NextResponse.json(
      { ok: false, error: "UNEXPECTED_ERROR", details: String(e?.message || e) },
      { status: 500 }
    );
  }
}
