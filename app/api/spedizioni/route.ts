// app/api/spedizioni/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/* -------------------- tipi payload -------------------- */
type Party = {
  ragioneSociale?: string;
  referente?: string;
  paese?: string;
  citta?: string;
  cap?: string;
  indirizzo?: string;
  telefono?: string;
  piva?: string;
};

type Payload = {
  sorgente?: string;
  tipoSped?: string;
  destAbilitato?: boolean;
  contenuto?: string;
  formato?: string;
  ritiroData?: string;
  ritiroNote?: string;
  mittente?: Party;
  destinatario?: Party;
  incoterm?: string;
  valuta?: string;
  noteFatt?: string;
  fatturazione?: Party;
  fattSameAsDest?: boolean;
  fattDelega?: boolean;
  fatturaFileName?: string | null;
  colli?: any[];
  packingList?: any[];

  // possibili campi lato client
  emailCliente?: string;
  customerEmail?: string;
  createdByEmail?: string;
};

/* -------------------- helpers -------------------- */
function makeHumanId(date = new Date()): string {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  const suffix = Math.floor(Math.random() * 100000)
    .toString()
    .padStart(5, "0");
  return `SP-${yyyy}-${mm}-${dd}-${suffix}`;
}

function normalizeEmail(raw?: string | null): string | null {
  const v = (raw ?? "").trim().toLowerCase();
  if (!v || !v.includes("@")) return null;
  return v;
}

function computePackageMetrics(collo: any) {
  const L = Number(collo?.lunghezza_cm ?? 0);
  const W = Number(collo?.larghezza_cm ?? 0);
  const H = Number(collo?.altezza_cm ?? 0);
  const weight = Number(collo?.peso_kg ?? 0);

  const validDims = L > 0 && W > 0 && H > 0;
  const volume_cm3 = validDims ? L * W * H : null;
  const volumetric_divisor = 5000;
  const weight_vol_kg = volume_cm3 ? volume_cm3 / volumetric_divisor : null;
  const weight_tariff_kg =
    weight_vol_kg != null ? Math.max(weight, weight_vol_kg) : weight || null;

  return {
    length_cm: validDims ? L : null,
    width_cm: validDims ? W : null,
    height_cm: validDims ? H : null,
    weight_kg: weight || null,
    volume_cm3,
    weight_volumetric_kg: weight_vol_kg,
    weight_tariff_kg,
    volumetric_divisor,
  };
}

function envOrThrow(name: string): string {
  const v = process.env[name];
  if (!v || v.trim() === "") throw new Error(`Missing env ${name}`);
  return v;
}

function getSupabaseAdmin() {
  const url = envOrThrow("NEXT_PUBLIC_SUPABASE_URL");
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE;
  return createClient(url, key!, {
    auth: { autoRefreshToken: false, persistSession: false },
    db: { schema: "spst" },
  });
}

// client con anon key per risolvere l’utente da access_token (se presente)
function getSupabaseAnon() {
  const url = envOrThrow("NEXT_PUBLIC_SUPABASE_URL");
  const anon = envOrThrow("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  return createClient(url, anon, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

async function pickEmailFromRequest(req: Request, body: Payload): Promise<string | null> {
  const url = new URL(req.url);

  // 1) querystring ?email=
  const qEmail = normalizeEmail(url.searchParams.get("email"));

  // 2) header custom
  const hdrEmail = normalizeEmail(req.headers.get("x-user-email"));

  // 3) body comuni
  const bodyEmail =
    normalizeEmail((body as any).emailCliente) ||
    normalizeEmail((body as any).customerEmail) ||
    normalizeEmail((body as any).createdByEmail);

  // 4) token Authorization: Bearer <access_token> -> supabase.auth.getUser()
  let tokenEmail: string | null = null;
  const auth = req.headers.get("authorization") || req.headers.get("Authorization");
  const m = auth?.match(/^Bearer\s+(.+)$/i);
  if (m && m[1]) {
    try {
      const supa = getSupabaseAnon();
      const { data, error } = await supa.auth.getUser(m[1]);
      if (!error) tokenEmail = normalizeEmail(data.user?.email ?? null);
    } catch {}
  }

  return qEmail || hdrEmail || bodyEmail || tokenEmail || null;
}

/* -------------------- routes -------------------- */
export async function GET() {
  return NextResponse.json(
    { ok: true, message: "Endpoint spedizioni (GET) non ancora implementato.", data: [] },
    { status: 200 }
  );
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as Payload;
  const id_human = makeHumanId();

  let email_cliente: string | null = null;
  try {
    email_cliente = await pickEmailFromRequest(req, body);
  } catch (e) {
    console.warn("[API/spedizioni] email resolution failed:", e);
  }
  const email_norm = normalizeEmail(email_cliente);

  const supabaseAdmin = getSupabaseAdmin();

  try {
    const mitt = body.mittente || {};
    const dest = body.destinatario || {};

    const giorno_ritiro =
      body.ritiroData && !Number.isNaN(Date.parse(body.ritiroData))
        ? new Date(body.ritiroData).toISOString().slice(0, 10)
        : null;

    const colli = Array.isArray(body.colli) ? body.colli : [];
    const colli_n = colli.length || null;
    const peso_reale_kg =
      colli.reduce((sum, c) => sum + (Number(c?.peso_kg ?? 0) || 0), 0) || null;

    const { data: shipmentRow, error: shipErr } = await supabaseAdmin
      .from("shipments")
      .insert({
        human_id: id_human,
        // --- email ---
        email_cliente: email_cliente,
        // avere sempre un campo normalizzato per filtri/indice
        email_norm: email_norm,

        // --- altri campi esistenti ---
        tipo_spedizione: body.tipoSped ?? null,
        incoterm: body.incoterm ?? null,
        incoterm_norm: body.incoterm ?? null,
        dest_abilitato_import: body.destAbilitato ?? null,
        note_ritiro: body.ritiroNote ?? null,
        giorno_ritiro,
        mittente_paese: mitt.paese ?? null,
        mittente_citta: mitt.citta ?? null,
        mittente_cap: mitt.cap ?? null,
        mittente_indirizzo: mitt.indirizzo ?? null,
        dest_paese: dest.paese ?? null,
        dest_citta: dest.citta ?? null,
        dest_cap: dest.cap ?? null,
        colli_n,
        peso_reale_kg,
      } as any)
      .select("*")
      .single();

    if (shipErr) {
      console.error("[API/spedizioni] insert shipments error:", shipErr);
      return NextResponse.json(
        {
          ok: false,
          id: id_human,
          recId: id_human,
          error: "DB_INSERT_SHIPMENT_FAILED",
          details: shipErr.message ?? shipErr,
        },
        { status: 500 }
      );
    }

    const shipmentId = (shipmentRow as any).id as string;

    if (colli.length > 0) {
      const rows = colli.map((c: any) => ({
        shipment_id: shipmentId,
        ...computePackageMetrics(c),
      }));
      const { error: pkgErr } = await getSupabaseAdmin().from("packages").insert(rows);
      if (pkgErr) {
        console.error("[API/spedizioni] insert packages error:", pkgErr);
        return NextResponse.json(
          {
            ok: false,
            id: id_human,
            recId: id_human,
            shipment_id: shipmentId,
            error: "DB_INSERT_PACKAGES_FAILED",
            details: pkgErr.message ?? pkgErr,
          },
          { status: 500 }
        );
      }
    }

    return NextResponse.json(
      { ok: true, id: id_human, recId: id_human, shipment_id: shipmentId },
      { status: 201 }
    );
  } catch (e: any) {
    console.error("[API/spedizioni] unexpected error:", e);
    return NextResponse.json(
      { ok: false, id: id_human, recId: id_human, error: "UNEXPECTED_ERROR", details: e?.message ?? String(e) },
      { status: 500 }
    );
  }
}
