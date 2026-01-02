// app/api/quotazioni/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabaseServerSpst } from "@/lib/supabase/server";

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

function normalizeEmail(x?: string | null) {
  const v = (x ?? "").trim();
  return v ? v.toLowerCase() : null;
}

// Normalizza gli stati delle quotazioni ai valori standard
function normalizeQuoteStatus(status?: string | null): string {
  const s = (status || "").trim().toUpperCase();
  
  // Mappa vecchi valori ai nuovi
  if (s === "IN LAVORAZIONE" || s === "IN_LAVORAZIONE" || s === "IN LAVORAZIONE" || s.includes("LAVORAZIONE")) {
    return "IN LAVORAZIONE";
  }
  if (s === "DISPONIBILE" || s === "DISPONIBILE" || s.includes("DISPONIBILE")) {
    return "DISPONIBILE";
  }
  if (s === "ACCETTATA" || s === "ACCETTATA" || s === "ACCEPTED" || s.includes("ACCETTATA")) {
    return "ACCETTATA";
  }
  
  // Default per quotazioni esistenti senza stato chiaro
  return "IN LAVORAZIONE";
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

  // canonico (client nuovo)
  valoreAssicurato?: number | string | null;

  // alias possibili (compat)
  valore_assicurato?: number | string | null;
  insurance_value_eur?: number | string | null;

  // compat vecchia (boolean, ignorato come fonte di verità)
  assicurazioneAttiva?: boolean | string | number;
  insurance_requested?: boolean | string | number;
  assicurazione_pallet?: boolean | string | number;

  formato?: "Pacco" | "Pallet"; 

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
    const bodyFields: any =
      body.fields && typeof body.fields === "object" ? body.fields : {};

    const mittente = body.mittente ?? bodyFields.mittente;
    const destinatario = body.destinatario ?? bodyFields.destinatario;
    const colli = Array.isArray(body.colli)
      ? body.colli
      : Array.isArray(bodyFields.colli)
      ? bodyFields.colli
      : null;

    if (!mittente || !destinatario || !Array.isArray(colli)) {
      return jsonError(400, "INVALID_PAYLOAD", {
        message: "Mittente, destinatario e colli sono obbligatori",
      });
    }

    const createdByEmail =
      body.createdByEmail ||
      body.customerEmail ||
      bodyFields.createdByEmail ||
      "info@spst.it";

    const customerEmail =
      body.customerEmail || bodyFields.customerEmail || createdByEmail;

    // ---------------------------
    // ✅ SOLO VALORE: declared_value
    // ---------------------------
    // Prendiamo il valore da: body.valoreAssicurato (canonico) oppure alias
    const valoreAssicuratoNum =
      toNum(
        firstNonEmpty(
          body.valoreAssicurato,
          body.valore_assicurato,
          body.insurance_value_eur,
          bodyFields?.valoreAssicurato,
          bodyFields?.valore_assicurato,
          bodyFields?.insurance_value_eur
        )
      ) ?? null;

    const declaredValue =
      valoreAssicuratoNum &&
      Number.isFinite(valoreAssicuratoNum) &&
      valoreAssicuratoNum > 0
        ? valoreAssicuratoNum
        : null;

    // Normalizzo la data ritiro in formato YYYY-MM-DD (colonna è "date")
    const dataRitiroDate = firstNonEmpty(body.ritiroData, bodyFields.ritiroData)
      ? new Date(firstNonEmpty(body.ritiroData, bodyFields.ritiroData) as string)
          .toISOString()
          .slice(0, 10)
      : null;

    // fields JSON “completo”
    // (manteniamo compat, ma fissiamo alias utili)
    const fields = {
      ...bodyFields,
      ...body,

      // forzo coerenza
      createdByEmail,
      customerEmail,

      // ✅ alias comodi nel JSON
      assicurazioneAttiva: Boolean(declaredValue),
      valoreAssicurato: declaredValue,
    };

    const { data, error } = await supabase
      .from("quotes")
      .insert({
        status: "IN LAVORAZIONE",
        incoterm: body.incoterm ?? bodyFields.incoterm ?? null,

        // ✅ valore assicurato normalizzato
        declared_value: declaredValue,

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

        contenuto_colli:
          body.contenutoColli ?? bodyFields.contenutoColli ?? null,

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
  // ✅ CLIENT SCOPE: filtra per email_cliente dalla sessione
  const supa = supabaseServerSpst();
  const { data: userData, error: userErr } = await supa.auth.getUser();
  const userEmail = userData?.user?.email ? String(userData.user.email) : null;

  if (userErr || !userEmail) {
    return jsonError(401, "UNAUTHENTICATED", {
      message: "Autenticazione richiesta",
    });
  }

  const emailNorm = userEmail.toLowerCase().trim();

  const supabase = makeSupabase();
  if (!supabase) {
    return jsonError(500, "MISSING_SUPABASE_ENV", {
      message:
        "Variabili Supabase mancanti (NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE).",
    });
  }

  try {
    // ✅ Filtra per creato_da_email o fields.createdByEmail (solo le quotazioni del cliente autenticato)
    // Nota: tutte le quotazioni hanno email_cliente = info@spst.it, quindi filtriamo per creato_da_email
    let query = supabase
      .from("quotes")
      .select("id, status, fields, created_at, incoterm, declared_value, email_cliente, destinatario, creato_da_email, colli")
      .eq("creato_da_email", emailNorm)
      .order("created_at", { ascending: false })
      .limit(100);

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

        // ✅ fonte di verità: declared_value se presente
        const valoreAssicurato =
          row.declared_value !== null && row.declared_value !== undefined
            ? Number(row.declared_value)
            : toNum(f.valoreAssicurato);

        const assicurazioneAttiva = Boolean(valoreAssicurato && valoreAssicurato > 0);

        // Normalizza stato: mappa vecchi valori ai nuovi
        const normalizedStatus = normalizeQuoteStatus(row.status);

        const aliasedFields = {
          ...f,

          // alias esistenti
          Stato: normalizedStatus,
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

        // Calcola colli_n da colli array
        const colliArray = Array.isArray(row.colli) ? row.colli : (Array.isArray(f.colli) ? f.colli : []);
        const colli_n = colliArray.length > 0 ? colliArray.length : null;

        return { 
          id: row.id, 
          status: normalizedStatus,
          fields: aliasedFields,
          // ✅ campi aggiuntivi per UI
          destinatario: row.destinatario || dest,
          formato_sped: f.formato || null, // formato è salvato in fields.formato
          colli_n: colli_n,
        };
      }) ?? [];

    return NextResponse.json({ ok: true, rows }, { status: 200 });
  } catch (e: any) {
    console.error("[API/quotazioni:GET] ERROR", e?.message || e);
    return jsonError(500, "SERVER_ERROR", { message: e?.message });
  }
}
