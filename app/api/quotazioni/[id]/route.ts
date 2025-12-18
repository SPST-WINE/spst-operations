// app/api/quotazioni/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

// ---------- Helpers -------------------------------------------------

function makeSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    console.error("[API/quotazioni/:id] Missing Supabase env", {
      hasUrl: !!url,
      hasKey: !!key,
    });
    return null;
  }

  return createClient(url, key, {
    auth: { persistSession: false },
    db: { schema: "spst" },
  });
}

function jsonError(status: number, error: string, extra?: Record<string, any>) {
  return NextResponse.json({ ok: false, error, ...extra }, { status });
}

// ---------- GET: dettaglio preventivo -------------------------------

export async function GET(req: NextRequest, ctx: { params: { id: string } }) {
  const id = decodeURIComponent((ctx.params?.id || "").trim());
  if (!id) return jsonError(400, "MISSING_ID");

  const supabase = makeSupabase();
  if (!supabase) {
    return jsonError(500, "MISSING_SUPABASE_ENV", {
      message:
        "Variabili Supabase mancanti (NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE).",
    });
  }

  try {
    const { data, error } = await supabase
      .from("quotes")
      .select("id, status, fields, created_at, incoterm, declared_value")
      .eq("id", id)
      .single();

    if (error) {
      console.error("[API/quotazioni/:id] DB_ERROR", error);
      if ((error as any).code === "PGRST116") {
        return jsonError(404, "NOT_FOUND");
      }
      return jsonError(500, "DB_ERROR", { details: error.message });
    }

    if (!data) return jsonError(404, "NOT_FOUND");

    const f: any = data.fields || {};
    const mitt = f.mittente || {};
    const dest = f.destinatario || {};
    const colli = Array.isArray(f.colli) ? f.colli : [];

    const valoreAssicurato =
  data.declared_value != null
    ? Number(data.declared_value)
    : (f.valoreAssicurato != null ? Number(f.valoreAssicurato) : null);

const assicurazioneAttiva =
  !!valoreAssicurato && Number.isFinite(valoreAssicurato) && valoreAssicurato > 0;


    const fields = {
      ...f,

      // alias esistenti
      Stato: data.status || "In lavorazione",
      Destinatario_Nome: dest.ragioneSociale,
      Destinatario_Citta: dest.citta,
      Destinatario_Paese: dest.paese,
      Mittente_Nome: mitt.ragioneSociale,
      "Creato il": data.created_at,
      "Creato da Email": f.createdByEmail,
      Slug_Pubblico: data.id,
      Incoterm: data.incoterm,

      // ✅ nuovi alias
      assicurazioneAttiva,
      valoreAssicurato,
      Assicurazione_Attiva: assicurazioneAttiva ? "Sì" : "No",
      Valore_Assicurato: valoreAssicurato,
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
