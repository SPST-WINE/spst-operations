// app/api/spedizioni/[id]/attachments/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

type Params = { params: { id: string } };

function envOrThrow(name: string): string {
  const v = process.env[name];
  if (!v || v.trim() === "") throw new Error(`Missing env ${name}`);
  return v;
}

function admin() {
  const url = envOrThrow("NEXT_PUBLIC_SUPABASE_URL");
  const key = envOrThrow("SUPABASE_SERVICE_ROLE");
  // uso schema spst, ma potresti usare anche public se preferisci le view
  return createClient(url, key, {
    db: { schema: "spst" },
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { "X-Client-Info": "spst-operations/attachments" } },
  });
}

// GET /api/spedizioni/[id]/attachments
export async function GET(_req: Request, { params }: Params) {
  const { id } = params;

  try {
    const supa = admin();

    const { data, error } = await supa
      .from("shipment_documents")
      .select(
        "id, shipment_id, doc_type, file_name, mime_type, file_size, url, created_at"
      )
      .eq("shipment_id", id)
      .order("created_at", { ascending: true });

    if (error) throw error;

    const attachments = (data || []).map((row: any) => {
      let label = row.doc_type;
      if (row.doc_type === "fattura_proforma") label = "Fattura proforma";
      else if (row.doc_type === "packing_list") label = "Packing list";
      else if (row.doc_type === "fattura_commerciale") label = "Fattura commerciale";
      else if (row.doc_type === "ldv") label = "Lettera di vettura";

      return {
        id: row.id as string,
        type: row.doc_type as string,
        label,
        url: (row.url as string | null) ?? null,
        fileName: (row.file_name as string | null) ?? null,
        mimeType: (row.mime_type as string | null) ?? null,
        size: (row.file_size as number | null) ?? null,
        createdAt: row.created_at as string | null,
      };
    });

    return NextResponse.json({ ok: true, attachments });
  } catch (e: any) {
    console.error("[API/spedizioni/:id/attachments] GET error:", e);
    return NextResponse.json(
      {
        ok: false,
        attachments: [],
        error: e?.message || "SERVER_ERROR",
      },
      { status: 500 }
    );
  }
}

// POST per ora non serve: lo lasciamo non implementato esplicitamente
export async function POST() {
  return NextResponse.json(
    { ok: false, error: "NOT_IMPLEMENTED" },
    { status: 405 }
  );
}
