// app/api/spedizioni/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/* ───────────── Helpers ───────────── */
type Party = {
  ragioneSociale?: string;
  referente?: string;
  paese?: string;
  citta?: string;
  cap?: string;
  indirizzo?: string;
  telefono?: string;
  piva?: string;
  email?: string;
};

type Collo = {
  l1?: number | string;
  l2?: number | string;
  l3?: number | string;
  peso?: number | string;
  contenuto?: string;
  [k: string]: any;
};

function toNum(x: any): number | null {
  if (x === null || x === undefined) return null;
  const n = Number(String(x).replace(",", ".").trim());
  return Number.isFinite(n) ? n : null;
}

function firstNonEmpty(...vals: (string | undefined | null)[]) {
  for (const v of vals) {
    if (v && String(v).trim() !== "") return String(v).trim();
  }
  return "";
}

function normalizeEmail(x?: string | null) {
  const v = (x ?? "").trim();
  return v ? v.toLowerCase() : null;
}

function toISODate(d?: string | null): string | null {
  if (!d) return null;
  const s = d.trim();

  // dd-mm-yyyy
  const m1 = /^(\d{2})[-\/](\d{2})[-\/](\d{4})$/.exec(s);
  if (m1) {
    const [_, dd, mm, yyyy] = m1;
    return `${yyyy}-${mm}-${dd}`;
  }
  // yyyy-mm-dd
  const m2 = /^(\d{4})[-\/](\d{2})[-\/](\d{2})$/.exec(s);
  if (m2) return s.substring(0, 10);

  const t = Date.parse(s);
  if (!isNaN(t)) return new Date(t).toISOString().slice(0, 10);
  return null;
}

/* ───────────── Next config ───────────── */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

/* ───────────── CORS preflight (facoltativo ma comodo) ───────────── */
export function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type,Authorization",
      "Access-Control-Max-Age": "86400",
    },
  });
}

/* ───────────── POST /api/spedizioni ───────────── */
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({} as any));

    // Mittente/Destinatario
    const mitt: Party = body.mittente ?? {};
    const dest: Party = body.destinatario ?? {};

    // Email raw + normalizzata
    const emailRaw = firstNonEmpty(
      body.email,
      body.email_cliente,
      mitt.email,
      body.mittente_email
    );
    const emailNorm = normalizeEmail(emailRaw);

    // Colli
    const colli: Collo[] = Array.isArray(body.colli) ? body.colli : [];
    const colli_n = colli.length || toNum(body.colli_n) || null;
    const pesoTot = colli.reduce((sum, c) => {
      const p = toNum(c?.peso) || 0;
      return sum + p;
    }, 0);
    const peso_reale_kg =
      pesoTot > 0 ? Number(pesoTot.toFixed(3)) : toNum(body.peso_reale_kg);

    // Giorno ritiro
    const giorno_ritiro = toISODate(body.ritiroData ?? body.giorno_ritiro);

    // Incoterm
    const incoterm = firstNonEmpty(body.incoterm, body.incoterm_norm).toUpperCase() || null;

    // Tipo spedizione
    const tipo_spedizione = firstNonEmpty(body.tipoSped, body.tipo_spedizione) || null;

    // Dest abilitato import
    const dest_abilitato_import =
      typeof body.destAbilitato === "boolean"
        ? body.destAbilitato
        : typeof body.dest_abilitato_import === "boolean"
        ? body.dest_abilitato_import
        : null;

    // Note ritiro
    const note_ritiro = body.ritiroNote ?? body.note_ritiro ?? null;

    // Indirizzi
    const mittente_paese = mitt.paese ?? body.mittente_paese ?? null;
    const mittente_citta = mitt.citta ?? body.mittente_citta ?? null;
    const mittente_cap = mitt.cap ?? body.mittente_cap ?? null;
    const mittente_indirizzo = mitt.indirizzo ?? body.mittente_indirizzo ?? null;

    const dest_paese = dest.paese ?? body.dest_paese ?? null;
    const dest_citta = dest.citta ?? body.dest_citta ?? null;
    const dest_cap = dest.cap ?? body.dest_cap ?? null;

    /* ───── Supabase server client (service role lato server) ───── */
    const SUPABASE_URL =
      process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
    const SUPABASE_SERVICE_ROLE_KEY =
      process.env.SUPABASE_SERVICE_ROLE || process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!SUPABASE_URL) {
      throw new Error("Missing SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL).");
    }
    if (!SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error("Missing SUPABASE_SERVICE_ROLE (or SUPABASE_SERVICE_ROLE_KEY).");
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });

    /* ───── Prepara INSERT in spst.shipments ───── */
    const insertRow = {
      email_cliente: emailRaw || null,
      email_norm: emailNorm,

      mittente_paese,
      mittente_citta,
      mittente_cap,
      mittente_indirizzo,

      dest_paese,
      dest_citta,
      dest_cap,

      tipo_spedizione,
      incoterm,
      incoterm_norm: incoterm,
      dest_abilitato_import,
      note_ritiro,
      giorno_ritiro,

      peso_reale_kg,
      colli_n,

      // opzionali
      carrier: body.carrier ?? null,
      service_code: body.service_code ?? null,
      pickup_at: body.pickup_at ?? null,
      tracking_code: body.tracking_code ?? null,
      declared_value: toNum(body.declared_value),
      status: body.status ?? "draft",

      // cattura tutto il payload extra
      fields: body,
    };

const { data: shipment, error: insertErr } = await supabase
  .schema("spst")
  .from("shipments")
  .insert(insertRow)
  .select()
  .single();

if (insertErr) {
  console.error("[API/spedizioni] insert error:", insertErr);
  return NextResponse.json(
    { ok: false, error: "INSERT_FAILED", details: insertErr.message },
    { status: 500 }
  );
}

// INSERT packages (se ci sono colli)
if (Array.isArray(colli) && colli.length > 0) {
  const pkgs = colli.map((c) => {
    const l1 = toNum(c.l1);
    const l2 = toNum(c.l2);
    const l3 = toNum(c.l3);
    const peso = toNum(c.peso);
    return {
      shipment_id: shipment.id,
      l1,
      l2,
      l3,
      weight_kg: peso,
      fields: c,
    };
  });

  const { error: pkgErr } = await supabase
    .schema("spst")
    .from("packages")
    .insert(pkgs);

  if (pkgErr) {
    console.warn("[API/spedizioni] packages insert warning:", pkgErr.message);
  }
}

    const res = NextResponse.json({ ok: true, shipment });
    res.headers.set("Access-Control-Allow-Origin", "*");
    return res;
  } catch (e: any) {
    console.error("[API/spedizioni] unexpected:", e);
    return NextResponse.json(
      { ok: false, error: "UNEXPECTED_ERROR", details: String(e?.message || e) },
      { status: 500,
        headers: { "Access-Control-Allow-Origin": "*" }
      }
    );
  }
}
