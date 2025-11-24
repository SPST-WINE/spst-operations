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

    const ext = file.name.split(".").pop();
    const safeExt = ext || "bin";

    const path = `${shipmentId}/${type}.${safeExt}`;

    // Upload file
    const { error: uploadError } = await supa.storage
      .from("shipment-docs")
      .upload(path, file, {
        upsert: true,
        cacheControl: "3600",
      });

    if (uploadError) {
      return NextResponse.json(
        { ok: false, error: uploadError.message },
        { status: 500 }
      );
    }

    // Public URL
    const { data: publicData } = supa.storage
      .from("shipment-docs")
      .getPublicUrl(path);

    const publicUrl = publicData.publicUrl;

    // Update DB field
    const field = type as
      | "ldv"
      | "fattura_proforma"
      | "fattura_commerciale"
      | "dle"
      | "allegato1"
      | "allegato2"
      | "allegato3"
      | "allegato4";

    const updatePayload = {
      [field]: {
        url: publicUrl,
        file_name: file.name,
        uploaded_at: new Date().toISOString(),
      },
    };

    const { error: updateError } = await supa
      .schema("spst")
      .from("shipments")
      .update(updatePayload)
      .eq("id", shipmentId);

    if (updateError) {
      return NextResponse.json(
        { ok: false, error: updateError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true, url: publicUrl });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e.message || "UNKNOWN_ERROR" },
      { status: 500 }
    );
  }
}
