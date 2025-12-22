// app/api/spedizioni/[id]/allegati/route.ts
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

const ATTACH_KEYS = [
  "ldv",
  "fattura_proforma",
  "fattura_commerciale",
  "dle",
  "allegato1",
  "allegato2",
  "allegato3",
  "allegato4",
] as const;

function pickAllowedAttachments(payload: Record<string, any>) {
  const out: Record<string, any> = {};
  for (const k of ATTACH_KEYS) {
    if (k in payload) out[k] = payload[k];
  }
  return out;
}

const SELECT_ATTACH = `id,${ATTACH_KEYS.join(",")}`;

// compat: PATCH staff-only, whitelist
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const staff = await requireStaff();
  if ("response" in staff) return staff.response;

  const id = params.id;
  if (!id)
    return NextResponse.json({ ok: false, error: "MISSING_ID" }, { status: 400 });

  const payload = (await req.json().catch(() => ({} as any))) as Record<string, any>;
  const update = pickAllowedAttachments(payload);

  if (Object.keys(update).length === 0) {
    return NextResponse.json(
      { ok: false, error: "NO_ALLOWED_FIELDS" },
      { status: 400 }
    );
  }

  try {
    const supaAdmin = admin();
    const { data, error } = await (supaAdmin as any)
      .schema("spst")
      .from("shipments")
      .update(update)
      .eq("id", id)
      .select(SELECT_ATTACH)
      .single();

    if (error || !data)
      return NextResponse.json(
        { ok: false, error: "UPDATE_FAILED", details: error?.message ?? null },
        { status: 500 }
      );

    return NextResponse.json({ ok: true, shipment_id: id, attachments: data });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: "SERVER_ERROR", details: String(e?.message || e) },
      { status: 500 }
    );
  }
}
