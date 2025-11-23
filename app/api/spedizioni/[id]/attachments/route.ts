// app/api/spedizioni/[id]/attachments/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

type Params = { params: { id: string } };

function envOrThrow(name: string): string {
  const v = process.env[name];
  if (!v || !v.trim()) {
    throw new Error(`Missing env ${name}`);
  }
  return v;
}

function admin() {
  const url = envOrThrow("NEXT_PUBLIC_SUPABASE_URL");
  const key = envOrThrow("SUPABASE_SERVICE_ROLE");
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

function labelForDocType(t?: string | null): string {
  switch (t) {
    case "fattura_proforma":
      return "Fattura Proforma";
    case "fattura_commerciale":
      return "Fattura Commerciale";
    case "packing_list":
      return "Packing List";
    case "ldv":
      return "Lettera di Vettura";
    case "dle":
      return "Dichiarazione Libera Esportazione";
    default:
      return t || "Documento";
  }
}

// GET /api/spedizioni/[id]/attachments
export async function GET(_req: Request, { params }: Params) {
  const shipmentId = params.id;

  try {
    const supa = admin();

    const { data, error } = await supa
      .from("shipment_documents")
      .select(
        "id, shipment_id, doc_type, file_name, mime_type, file_size, url, storage_path, created_at"
      )
      .eq("shipment_id", shipmentId)
      .order("created_at", { ascending: true });

    if (error) {
      console.error(
        "[API/spedizioni/:id/attachments] select error:",
        error.message
      );
      return NextResponse.json(
        { ok: false, error: "DB_ERROR", details: error.message },
        { status: 500 }
      );
    }

    const attachments = (data || []).map((r) => ({
      id: r.id as string,
      type: (r as any).doc_type as string,
      label: labelForDocType((r as any).doc_type),
      url: (r as any).url as string | null,
      fileName: (r as any).file_name as string | null,
      mimeType: (r as any).mime_type as string | null,
      size: (r as any).file_size as number | null,
      createdAt: (r as any).created_at as string | null,
      path: (r as any).storage_path as string | null,
    }));

    return NextResponse.json({ ok: true, attachments });
  } catch (e: any) {
    console.error(
      "[API/spedizioni/:id/attachments] unexpected error:",
      e?.message || e
    );
    return NextResponse.json(
      { ok: false, error: "UNEXPECTED_ERROR", details: String(e?.message || e) },
      { status: 500 }
    );
  }
}

// (facoltativo) POST ancora non necessario: lasciamo placeholder
export async function POST(_req: Request, { params }: Params) {
  return NextResponse.json(
    {
      ok: true,
      message: `Upload allegati per spedizione ${params.id} gestito lato client tramite upload su bucket + insert su shipment_documents.`,
    },
    { status: 200 }
  );
}
