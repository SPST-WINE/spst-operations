// app/api/quotazioni/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// client service-role (solo lato server)
const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

// Tipi minimi allineati a lib/api.ts
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

function jsonError(status: number, error: string, extra?: Record<string, any>) {
  return NextResponse.json({ ok: false, error, ...extra }, { status });
}

// POST /api/quotazioni  → crea record in spst.quotes
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as QuoteCreatePayload;

    if (!body.mittente || !body.destinatario || !Array.isArray(body.colli)) {
      return jsonError(400, "INVALID_PAYLOAD", {
        message: "Mittente, destinatario e colli sono obbligatori",
      });
    }

    // Per ora non abbiamo l'email reale dall'auth, mettiamo un fallback
    const createdByEmail =
      body.createdByEmail ||
      body.customerEmail ||
      "info@spst.it";

    const customerEmail = body.customerEmail || createdByEmail;

    const fields = {
      ...body,
      createdByEmail,
      customerEmail,
    };

    const { data, error } = await supabase
      .from("quotes")
      .insert({
        status: "In lavorazione",
        incoterm: body.incoterm,
        // declared_value per ora null
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

// GET /api/quotazioni  → lista (per ora non filtrata per utente)
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const email = searchParams.get("email") || undefined;

    let query = supabase
      .from("quotes")
      .select("id, status, fields, created_at")
      .order("created_at", { ascending: false })
      .limit(100);

    if (email) {
      // filtra su fields.createdByEmail se presente
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

        // alias in stile vecchio Airtable, così la UI attuale non esplode
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
        };

        return { id: row.id, fields: aliasedFields };
      }) ?? [];

    return NextResponse.json({ ok: true, rows }, { status: 200 });
  } catch (e: any) {
    console.error("[API/quotazioni:GET] ERROR", e?.message || e);
    return jsonError(500, "SERVER_ERROR", { message: e?.message });
  }
}
