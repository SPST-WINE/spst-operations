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

function toBool(x: any): boolean {
  if (typeof x === "boolean") return x;
  if (typeof x === "number") return x !== 0;
  if (typeof x === "string") {
    const v = x.trim().toLowerCase();
    if (["true", "1", "yes", "y", "si", "sì", "on"].includes(v)) return true;
    if (["false", "0", "no", "n", "off", ""].includes(v)) return false;
  }
  return false;
}

function toNum(x: any): number | null {
  if (x === null || x === undefined) return null;
  const n = Number(String(x).replace(",", ".").trim());
  return Number.isFinite(n) ? n : null;
}

function firstNonEmpty<T = any>(...vals: T[]) {
  for (const v of vals) {
    if (v !== undefined && v !== null) return v;
  }
  return undefined;
}

// ---------- Types ---------------------------------------------------

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

  contenutoColli?: string;

  // "canonici"
  assicurazioneAttiva?: boolean | string | number;
  valoreAssicurato?: number | string | null;

  // alias possibili dal client (li supportiamo senza rompere nulla)
  insurance_requested?: boolean | string | number;
  insurance_value_eur?: number | string | null;
  assicurazione_pallet?: boolean | string | number;
  valore_assicurato?: number | string | null;

  fields?: any; // se un domani mandi già un payload "fields"
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

    // Se arriva già un oggetto fields, lo consideriamo (non obbligatorio)
    const bodyFields: any = body.fields && typeof body.fields === "object" ? body.fields : {};

    const mittente = body.mittente ?? bodyFields.mittente;
    const destinatario = body.destinatario ?? bodyFields.destinatario;
    const colli = Array.isArray(body.colli) ? body.colli : Array.isArray(bodyFields.colli) ? bodyFields.colli : null;

    if (!mittente || !destinatario || !Array.isArray(colli)) {
      return jsonError(400, "INVALID_PAYLOAD", {
        message: "Mittente, destinatario e colli sono obbligatori",
      });
    }

    const createdByEmail =
      body.createdByEmail || body.customerEmail || bodyFields.createdByEmail || "info@spst.it";
    const customerEmail =
      body.customerEmail || bodyFields.customerEmail || createdByEmail;

    // --- Assicurazione: supporto alias ---
    const assicurazioneAttiva = toBool(
      firstNonEmpty(
        body.assicurazioneAttiva,
        body.insurance_requested,
        body.assicurazione_pallet,
        bodyFields.assicurazioneAttiva,
        bodyFields.insurance_requested,
        bodyFields.assicurazione_pallet
      )
    );

    const valoreAssicurato = toNum(
      firstNonEmpty(
        body.valoreAssicurato,
        body.valore_assicurato,
        body.insurance_value_eur,
        bodyFields.valoreAssicurato,
        bodyFields.valore_assicurato,
        bodyFields.insurance_value_eur
      )
    );

    // Se assicurazione ON, valore deve essere valido > 0
    if (assicurazioneAttiva) {
      if (!valoreAssicurato || valoreAssicurato <= 0) {
        return jsonError(400, "INVALID_INSURANCE_VALUE", {
          message:
            "Assicurazione attiva: valore assicurato mancante o non valido (> 0).",
        });
      }
    }

    // Normalizzo la data ritiro in formato YYYY-MM-DD (colonna è "date")
    const dataRitiroDate =
      body.ritiroData
        ? new Date(body.ritiroData).toISOString().slice(0, 10)
        : bodyFields.ritiroData
        ? new Date(bodyFields.ritiroData).toISOString().slice(0, 10)
        : null;

    // fields JSON “completo”
    const fields = {
      ...bodyFields,
      ...body,

      // forzo coerenza
      createdByEmail,
      customerEmail,

      assicurazioneAttiva,
      valoreAssicurato: assicurazioneAttiva ? valoreAssicurato : null,
    };

    const { data, error } = await supabase
      .from("quotes")
      .insert({
        status: "In lavorazione",
        incoterm: body.incoterm ?? bodyFields.incoterm ?? null,

        // ✅ colonna usata come "valore assicurato"
        declared_value: assicurazioneAttiva ? valoreAssicurato : null,

        // colonne normalizzate
        data_ritiro: dataRitiroDate,
        tipo_spedizione: body.tipoSped ?? bodyFields.tipoSped ?? null,
        valuta: body.valuta ?? bodyFields.valuta ?? null,
        note_generiche: body.noteGeneriche ?? bodyFields.noteGeneriche ?? null,
        email_cliente: customerEmail,
        creato_da_email: createdByEmail,
        mittente,
        destinatario,
        colli,

        contenuto_colli: body.contenutoColli ?? bodyFields.contenutoColli ?? null,

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
      .select("id, status, fields, created_at, incoterm, declared_value")
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

        const assicurazioneAttiva = toBool(f.assicurazioneAttiva);

        const valoreAssicurato =
          (row.declared_value ?? null) !== null
            ? Number(row.declared_value)
            : toNum(f.valoreAssicurato);

        const aliasedFields = {
          ...f,

          // alias esistenti
          Stato: row.status || "In lavorazione",
          Destinatario_Nome: dest.ragioneSociale,
          Destinatario_Citta: dest.citta,
          Destinatario_Paese: dest.paese,
          Mittente_Nome: mitt.ragioneSociale,
          "Creato il": row.created_at,
          "Creato da Email": f.createdByEmail,
          Slug_Pubblico: row.id,
          Incoterm: row.incoterm,

          // ✅ nuovi alias + campi raw comodi
          assicurazioneAttiva,
          valoreAssicurato,
          Assicurazione_Attiva: assicurazioneAttiva ? "Sì" : "No",
          Valore_Assicurato: valoreAssicurato,
        };

        return { id: row.id, fields: aliasedFields };
      }) ?? [];

    return NextResponse.json({ ok: true, rows }, { status: 200 });
  } catch (e: any) {
    console.error("[API/quotazioni:GET] ERROR", e?.message || e);
    return jsonError(500, "SERVER_ERROR", { message: e?.message });
  }
}
