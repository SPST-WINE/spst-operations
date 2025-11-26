// app/api/quotazioni/route.ts
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
    console.error("[API/quotazioni] Missing Supabase env", {
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

type QuoteParty = {
  ragioneSociale?: string;
  paese?: string;
  citta?: string;
  cap?: string;
  indirizzo?: string;
  telefono?: string;
  taxId?: string;
};

type QuoteCollo = {
  quantita?: number;
  lunghezza_cm?: number | null;
  larghezza_cm?: number | null;
  altezza_cm?: number | null;
  peso_kg?: number | null;
};

type QuoteCreatePayload = {
  mittente?: QuoteParty;
  destinatario?: QuoteParty;
  colli?: QuoteCollo[];
  valuta?: "EUR" | "USD" | "GBP";
  noteGeneriche?: string;
  ritiroData?: string;
  tipoSped?: "B2B" | "B2C" | "Sample";
  incoterm?: "DAP" | "DDP" | "EXW";
  createdByEmail?: string;
  customerEmail?: string;
};

// ---------- POST: crea preventivo -----------------------------------

export async function POST(req: NextRequest) {
  const supabase = makeSupabase();
  if (!supabase) {
    return jsonError(500, "MISSING_SUPABASE_ENV", {
      message:
        "Variabili Supabase mancanti (NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE).",
    });
  }

  try {
    const body = (await req.json().catch(() => ({}))) as QuoteCreatePayload;

    if (!body.mittente || !body.destinatario || !Array.isArray(body.colli)) {
      return jsonError(400, "INVALID_PAYLOAD", {
        message: "Mittente, destinatario e colli sono obbligatori",
      });
    }

    const createdByEmail =
      body.createdByEmail || body.customerEmail || "info@spst.it";
    const customerEmail = body.customerEmail || createdByEmail;

    const fields = {
      ...body,
      createdByEmail,
      customerEmail,
    };

        // Normalizzo la data ritiro in formato YYYY-MM-DD (colonna è "date")
    const dataRitiroDate =
      body.ritiroData ? new Date(body.ritiroData).toISOString().slice(0, 10) : null;

    const { data, error } = await supabase
      .from("quotes")
      .insert({
        status: "In lavorazione",
        declared_value: null,

        // colonne "di testa"
        incoterm: body.incoterm ?? null,
        origin: "dashboard",

        email_cliente: customerEmail,
        creato_da_email: createdByEmail,
        data_ritiro: dataRitiroDate,
        tipo_spedizione: body.tipoSped ?? null,
        valuta: body.valuta ?? "EUR",
        note_generiche: body.noteGeneriche ?? null,

        // JSON strutturati
        mittente: body.mittente ?? null,
        destinatario: body.destinatario ?? null,
        colli: body.colli ?? null,

        // payload completo per debug/compat
        fields,
      })
      .select("id")
      .single();


    if (error || !data) {
      console.error("[API/quotazioni:POST] DB_ERROR", error);
      return jsonError(500, "DB_ERROR", { details: error?.message });
    }

    return NextResponse.json(
      { ok: true as const, id: data.id, displayId: data.id },
      { status: 200 }
    );
  } catch (e: any) {
    console.error("[API/quotazioni:POST] ERROR", e?.message || e);
    return jsonError(500, "SERVER_ERROR", { message: e?.message });
  }
}

// ---------- GET: lista preventivi -----------------------------------

export async function GET(req: NextRequest) {
  const supabase = makeSupabase();
  if (!supabase) {
    return jsonError(500, "MISSING_SUPABASE_ENV", {
      message:
        "Variabili Supabase mancanti (NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE).",
    });
  }

  try {
    const { searchParams } = new URL(req.url);
    const email = searchParams.get("email") || undefined;

    let query = supabase
      .from("quotes")
      .select("id, status, fields, created_at, incoterm")
      .order("created_at", { ascending: false })
      .limit(100);

    if (email) {
      query = query.contains("fields", { createdByEmail: email });
    }

    const { data, error } = await query;

    if (error) {
      console.error("[API/quotazioni:GET] DB_ERROR", error);
      return jsonError(500, "DB_ERROR", { details: error?.message });
    }

    const rows =
      data?.map((row) => {
        const f: any = row.fields || {};
        const mitt = f.mittente || {};
        const dest = f.destinatario || {};

        const aliasedFields = {
          ...f,
          Stato: row.status || "In lavorazione",
          "Destinatario_Nome": dest.ragioneSociale,
          "Destinatario_Citta": dest.citta,
          "Destinatario_Paese": dest.paese,
          "Mittente_Nome": mitt.ragioneSociale,
          "Creato il": row.created_at,
          "Creato da Email": f.createdByEmail,
          Slug_Pubblico: row.id,
          Incoterm: row.incoterm,
        };

        return { id: row.id, fields: aliasedFields };
      }) ?? [];

    return NextResponse.json({ ok: true, rows }, { status: 200 });
  } catch (e: any) {
    console.error("[API/quotazioni:GET] ERROR", e?.message || e);
    return jsonError(500, "SERVER_ERROR", { message: e?.message });
  }
}
