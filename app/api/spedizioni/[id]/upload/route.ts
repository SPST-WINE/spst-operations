// app/api/spedizioni/[id]/upload/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const BUCKET = "shipments";
const ALLOWED = new Set([
  "ldv",
  "fattura_proforma",
  "fattura_commerciale",
  "dle",
  "allegato1",
  "allegato2",
  "allegato3",
  "allegato4",
]);

function bad(msg: string, status = 400) {
  return NextResponse.json({ ok: false, error: msg }, { status });
}

export async function POST(req: Request, ctx: { params: { id: string } }) {
  try {
    const shipmentId = ctx.params?.id;
    if (!shipmentId) return bad("Missing shipment id", 400);

    const SUPABASE_URL =
      process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
    const SERVICE_ROLE =
      process.env.SUPABASE_SERVICE_ROLE || process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!SUPABASE_URL || !SERVICE_ROLE) {
      return bad("Missing Supabase env (URL / SERVICE ROLE)", 500);
    }

    const supa = createClient(SUPABASE_URL, SERVICE_ROLE, {
      auth: { persistSession: false },
    }) as any;

    // ---- parse form-data
    const form = await req.formData();
    const file = form.get("file") as File | null;
    const type = String(form.get("type") || "").trim();

    if (!file) return bad("Missing file");
    if (!ALLOWED.has(type)) return bad("Invalid type");

    // ---- path destinazione
    const safeName = file.name?.replace(/[^a-zA-Z0-9._-]+/g, "_") || "file";
    const ts = Date.now();
    const path = `${shipmentId}/${type}/${ts}_${safeName}`;

    // ---- upload
    const arrayBuf = await file.arrayBuffer();
    const bytes = new Uint8Array(arrayBuf);

    const { error: upErr } = await supa.storage
      .from(BUCKET)
      .upload(path, bytes, {
        contentType: file.type || "application/octet-stream",
        upsert: false,
      });

    if (upErr) {
      console.error("[upload] storage.upload error:", upErr);
      return bad(upErr.message || "Upload failed", 500);
    }

    // ---- signed URL (es. 7 giorni)
    const { data: signData, error: signErr } = await supa.storage
      .from(BUCKET)
      .createSignedUrl(path, 60 * 60 * 24 * 7);
    if (signErr) {
      console.error("[upload] signedUrl error:", signErr);
      return bad(signErr.message || "Signed URL failed", 500);
    }

    // Oggetto allegato coerente con GET
    const attachment = {
      url: signData?.signedUrl,         // URL firmato per il client
      path,                             // path interno nel bucket
      filename: safeName,
      mime: file.type || "application/octet-stream",
      signed_expires_in: 60 * 60 * 24 * 7,
    };

    // ---- salva nel record spedizione
    const patch: Record<string, any> = {};
    patch[type] = attachment;

    const { error: updbErr } = await supa
      .schema("spst")
      .from("shipments")
      .update(patch)
      .eq("id", shipmentId);
    if (updbErr) {
      console.error("[upload] db update error:", updbErr);
      return bad(updbErr.message || "DB update failed", 500);
    }

    return NextResponse.json({
      ok: true,
      type,
      attachment,
    });
  } catch (e: any) {
    console.error("[upload] unexpected:", e);
    return bad(String(e?.message || e), 500);
  }
}
