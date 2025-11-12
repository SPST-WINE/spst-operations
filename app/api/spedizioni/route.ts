// app/api/spedizioni/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { cookies, headers as nextHeaders } from "next/headers";

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
  l1?: number | string | null;
  l2?: number | string | null;
  l3?: number | string | null;
  peso?: number | string | null;
  contenuto?: string | null;
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
  const m1 = /^(\d{2})[-\/](\d{2})[-\/](\d{4})$/.exec(s); // dd-mm-yyyy
  if (m1) {
    const [_, dd, mm, yyyy] = m1;
    return `${yyyy}-${mm}-${dd}`;
  }
  const m2 = /^(\d{4})[-\/](\d{2})[-\/](\d{2})$/.exec(s); // yyyy-mm-dd
  if (m2) return s.substring(0, 10);
  const t = Date.parse(s);
  if (!isNaN(t)) return new Date(t).toISOString().slice(0, 10);
  return null;
}

function getAccessTokenFromRequest() {
  const hdrs = nextHeaders();
  const auth = hdrs.get("authorization") || hdrs.get("Authorization") || "";
  if (auth.startsWith("Bearer ")) return auth.slice(7).trim();

  // fallback cookie (supabase-js salva JSON in supabase-auth-token)
  const jar = cookies();
  const sb = jar.get("sb-access-token")?.value;
  if (sb) return sb;

  const supaCookie = jar.get("supabase-auth-token")?.value; // è un JSON string
  if (supaCookie) {
    try {
      const arr = JSON.parse(supaCookie); // ["access_token","refresh_token",...]
      if (Array.isArray(arr) && arr[0]) return arr[0];
    } catch {}
  }
  return null;
}

/* ───────────── Next config ───────────── */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

/* ───────────── CORS preflight ───────────── */
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

    // ── Auth: prendi utente da Supabase senza auth-helpers ──
    const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
    const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY.");
    }
    const supabaseAuth = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: false },
    });

    const accessToken = getAccessTokenFromRequest();
    const { data: userData } = accessToken
      ? await supabaseAuth.auth.getUser(accessToken)
      : { data: { user: null } as any };

    const hdrs = nextHeaders();
    const emailFromHeaders =
      hdrs.get("x-user-email") || hdrs.get("x-client-email") || hdrs.get("x-auth-email") || null;

    const emailRaw = firstNonEmpty(
      userData?.user?.email || null,
      emailFromHeaders,
      body.email,
      body.email_cliente,
      body?.mittente?.email,
      body?.destinatario?.email,
      body?.fatturazione?.email,
      body?.fields?.fatturazione?.email
    );
    const emailNorm = normalizeEmail(emailRaw);

    // Mittente/Destinatario
    const mitt: Party = body.mittente ?? {};
    const dest: Party = body.destinatario ?? {};

    // Normalizza array colli (supporta entrambe le forme)
    const rawColli: any[] = Array.isArray(body.colli)
      ? body.colli
      : Array.isArray(body.colli_n)
      ? body.colli_n
      : [];
    const colli: Collo[] = rawColli.map((c: any) => ({
      l1: toNum(c.l1 ?? c.lunghezza_cm),
      l2: toNum(c.l2 ?? c.larghezza_cm),
      l3: toNum(c.l3 ?? c.altezza_cm),
      peso: toNum(c.peso ?? c.peso_kg),
      contenuto: c.contenuto ?? c.contenuto_colli ?? null,
      ...c,
    }));

    const colli_n: number | null = Array.isArray(colli) ? colli.length : null;
    const pesoTot = colli.reduce((sum, c) => sum + (toNum(c?.peso) || 0), 0);
    const peso_reale_kg = pesoTot > 0 ? Number(pesoTot.toFixed(3)) : toNum(body.peso_reale_kg);

    const giorno_ritiro = toISODate(body.ritiroData ?? body.giorno_ritiro);
    const incoterm = firstNonEmpty(body.incoterm, body.incoterm_norm).toUpperCase() || null;
    const tipo_spedizione = firstNonEmpty(body.tipoSped, body.tipo_spedizione) || null;
    const dest_abilitato_import =
      typeof body.destAbilitato === "boolean" ? body.destAbilitato
      : typeof body.dest_abilitato_import === "boolean" ? body.dest_abilitato_import
      : null;
    const note_ritiro = body.ritiroNote ?? body.note_ritiro ?? null;

    const mittente_paese = mitt.paese ?? body.mittente_paese ?? null;
    const mittente_citta = mitt.citta ?? body.mittente_citta ?? null;
    const mittente_cap = mitt.cap ?? body.mittente_cap ?? null;
    const mittente_indirizzo = mitt.indirizzo ?? body.mittente_indirizzo ?? null;

    const dest_paese = dest.paese ?? body.dest_paese ?? null;
    const dest_citta = dest.citta ?? body.dest_citta ?? null;
    const dest_cap = dest.cap ?? body.dest_cap ?? null;

    // ── Supabase (service role) per scrivere ──
    const SUPABASE_SERVICE_ROLE_KEY =
      process.env.SUPABASE_SERVICE_ROLE || process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error("Missing SUPABASE_SERVICE_ROLE (or SUPABASE_SERVICE_ROLE_KEY).");
    }
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });

    // JSONB 'fields' depurato (rimuovo chiavi che possono creare collisioni)
    const fieldsSafe = (() => {
      const clone: any = JSON.parse(JSON.stringify(body ?? {}));
      const blocklist = [
        "colli_n", "colli",
        "peso_reale_kg", "giorno_ritiro", "incoterm", "incoterm_norm",
        "tipoSped", "tipo_spedizione", "dest_abilitato_import",
        "mittente_paese","mittente_citta","mittente_cap","mittente_indirizzo",
        "dest_paese","dest_citta","dest_cap",
        "email","email_cliente","email_norm",
        "carrier","service_code","pickup_at","tracking_code","declared_value","status"
      ];
      for (const k of blocklist) delete clone[k];
      return clone;
    })();

    // INSERT in shipments
    const insertRow = {
      email_cliente: emailRaw || null,
      email_norm: emailNorm,
      mittente_paese, mittente_citta, mittente_cap, mittente_indirizzo,
      dest_paese, dest_citta, dest_cap,
      tipo_spedizione,
      incoterm,
      incoterm_norm: incoterm,
      dest_abilitato_import,
      note_ritiro,
      giorno_ritiro,
      peso_reale_kg,
      colli_n,
      carrier: body.carrier ?? null,
      service_code: body.service_code ?? null,
      pickup_at: body.pickup_at ?? null,
      tracking_code: body.tracking_code ?? null,
      declared_value: toNum(body.declared_value),
      status: body.status ?? "draft",
      fields: fieldsSafe,
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
        { status: 500, headers: { "Access-Control-Allow-Origin": "*" } }
      );
    }

    // INSERT colli in packages
    if (Array.isArray(colli) && colli.length > 0) {
      const pkgs = colli.map((c) => ({
        shipment_id: shipment.id,
        l1: toNum(c.l1 ?? c.lunghezza_cm),
        l2: toNum(c.l2 ?? c.larghezza_cm),
        l3: toNum(c.l3 ?? c.altezza_cm),
        weight_kg: toNum(c.peso ?? c.peso_kg),
        fields: c,
      }));
      const { error: pkgErr } = await supabase
        .schema("spst")
        .from("packages")
        .insert(pkgs);
      if (pkgErr) console.warn("[API/spedizioni] packages insert warning:", pkgErr.message);
    }

    const res = NextResponse.json({ ok: true, shipment });
    res.headers.set("Access-Control-Allow-Origin", "*");
    return res;
  } catch (e: any) {
    console.error("[API/spedizioni] unexpected:", e);
    return NextResponse.json(
      { ok: false, error: "UNEXPECTED_ERROR", details: String(e?.message || e) },
      { status: 500, headers: { "Access-Control-Allow-Origin": "*" } }
    );
  }
}
