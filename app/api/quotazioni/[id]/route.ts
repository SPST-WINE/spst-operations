// app/api/quotazioni/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

function jsonError(status: number, error: string, extra?: Record<string, any>) {
  return NextResponse.json({ ok: false, error, ...extra }, { status });
}

export async function GET(req: NextRequest, ctx: { params: { id: string } }) {
  const id = decodeURIComponent((ctx.params?.id || "").trim());

  if (!id) return jsonError(400, "MISSING_ID");

  try {
    const { data, error } = await supabase
      .from("quotes")
      .select("id, status, fields, created_at, incoterm")
      .eq("id", id)
      .single();

    if (error) {
      console.error("[API/quotazioni/:id] DB_ERROR", error);
      if (error.code === "PGRST116") {
        // not found
        return jsonError(404, "NOT_FOUND");
      }
      return jsonError(500, "DB_ERROR", { details: error.message });
    }

    if (!data) return jsonError(404, "NOT_FOUND");

    const f: any = data.fields || {};
    const mitt = f.mittente || {};
    const dest = f.destinatario || {};
    const colli = Array.isArray(f.colli) ? f.colli : [];

    const fields = {
      ...f,
      Stato: data.status || "In lavorazione",
      "Destinatario_Nome": dest.ragioneSociale,
      "Destinatario_Citta": dest.citta,
      "Destinatario_Paese": dest.paese,
      "Mittente_Nome": mitt.ragioneSociale,
      "Creato il": data.created_at,
      "Creato da Email": f.createdByEmail,
      Slug_Pubblico: data.id,
      Incoterm: data.incoterm,
    };

    const row = {
      id: data.id,
      displayId: data.id,
      fields,
      colli,
    };

    return NextResponse.json({ ok: true, row }, { status: 200 });
  } catch (e: any) {
    console.error("[API/quotazioni/:id] ERROR", e?.message || e);
    return jsonError(500, "SERVER_ERROR", { message: e?.message });
  }
}
