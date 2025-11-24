// app/api/spedizioni/[id]/upload/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

function admin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE!;
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

// tipi di documento ammessi (colonne jsonb in spst.shipments)
const VALID_TYPES = [
  "ldv",
  "fattura_proforma",
  "fattura_commerciale",
  "dle",
  "allegato1",
  "allegato2",
  "allegato3",
  "allegato4",
] as const;

type ValidType = (typeof VALID_TYPES)[number];

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  const shipmentId = params.id;
  const supa = admin();

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const type = formData.get("type") as string | null;

    if (!file || !type) {
      return NextResponse.json(
        { ok: false, error: "FILE_OR_TYPE_MISSING" },
        { status: 400 }
      );
    }

    if (!VALID_TYPES.includes(type as ValidType)) {
      return NextResponse.json(
        { ok: false, error: "INVALID_TYPE" },
        { status: 400 }
      );
    }

    const ext = file.name.includes(".") ? file.name.split(".").pop() : "";
    const safeExt = ext || "bin";
    const safeType = type as ValidType;

    // es: eb48cb60-.../ldv.pdf
    const path = `${shipmentId}/${safeType}.${safeExt}`;

    // Upload nel bucket "shipment-docs"
    const { error: uploadError } = await supa.storage
      .from("shipment-docs")
      .upload(path, file, {
        upsert: true,
        cacheControl: "3600",
      });

    if (uploadError) {
      console.error("[upload] storage error:", uploadError);
      return NextResponse.json(
        { ok: false, error: uploadError.message },
        { status: 500 }
      );
    }

    // URL pubblico
    const { data: publicData } = supa.storage
      .from("shipment-docs")
      .getPublicUrl(path);

    const publicUrl = publicData.publicUrl;

    // payload da salvare nella colonna jsonb corrispondente
    const updatePayload: Record<string, any> = {
      [safeType]: {
        url: publicUrl,
        file_name: file.name,
        mime_type: file.type,
        size: file.size,
        uploaded_at: new Date().toISOString(),
      },
    };

    // aggiorniamo la riga in spst.shipments
    const { error: updateError } = await supa
      .schema("spst")
      .from("shipments")
      .update(updatePayload)
      .eq("id", shipmentId);

    if (updateError) {
      console.error("[upload] db update error:", updateError);
      return NextResponse.json(
        { ok: false, error: updateError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      url: publicUrl,
      file_name: file.name,
      type: safeType,
    });
  } catch (e: any) {
    console.error("[upload] unknown error:", e);
    return NextResponse.json(
      { ok: false, error: e?.message || "UNKNOWN_ERROR" },
      { status: 500 }
    );
  }
}
