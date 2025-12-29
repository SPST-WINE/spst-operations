// app/api/spedizioni/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { cookies, headers as nextHeaders } from "next/headers";
import { ShipmentInputZ } from "@/lib/contracts/shipment";
import { supabaseServerSpst } from "@/lib/supabase/server";
import { Resend } from "resend";
import { buildSpedizionePrenotataHtml } from "@/lib/email/templates/spedizionePrenotata";


import crypto from "crypto";

function rid() {
  return crypto.randomUUID();
}

function safeJson(x: any, max = 2000) {
  try {
    const s = JSON.stringify(x);
    return s.length > max ? s.slice(0, max) + "…(truncated)" : s;
  } catch {
    return String(x);
  }
}

/* ───────────── Helpers ───────────── */

const toNum = (x: any): number | null => {
  if (x === null || x === undefined) return null;
  const n = Number(String(x).replace(",", ".").trim());
  return Number.isFinite(n) ? n : null;
};

function normalizeEmail(x?: string | null) {
  const v = (x ?? "").trim();
  return v ? v.toLowerCase() : null;
}

function getAccessTokenFromRequest() {
  const hdrs = nextHeaders();
  const auth = hdrs.get("authorization") || hdrs.get("Authorization") || "";
  if (auth.startsWith("Bearer ")) return auth.slice(7).trim();

  const jar = cookies();
  const sb = jar.get("sb-access-token")?.value;
  if (sb) return sb;

  const supaCookie = jar.get("supabase-auth-token")?.value;
  if (supaCookie) {
    try {
      const arr = JSON.parse(supaCookie);
      if (Array.isArray(arr) && arr[0]) return arr[0];
    } catch {}
  }
  return null;
}

const normAtt = (j: any) => (j && typeof j.url === "string" ? j : null);

function withCorsHeaders(init?: HeadersInit) {
  return {
    ...(init || {}),
    "Access-Control-Allow-Origin": "*",
  } as Record<string, string>;
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
      "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type,Authorization",
      "Access-Control-Max-Age": "86400",
    },
  });
}

/* ───────────── human_id generator ───────────── */
function formatHumanId(d: Date, n: number) {
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const yyyy = d.getUTCFullYear();
  return `SP-${dd}-${mm}-${yyyy}-${String(n).padStart(5, "0")}`;
}

async function nextHumanIdForToday(supabaseSrv: any): Promise<string> {
  const now = new Date();
  const dd = String(now.getUTCDate()).padStart(2, "0");
  const mm = String(now.getUTCMonth() + 1).padStart(2, "0");
  const yyyy = now.getUTCFullYear();
  const pattern = `SP-${dd}-${mm}-${yyyy}-`;

  const { count, error } = await (supabaseSrv as any)
    .schema("spst")
    .from("shipments")
    .select("human_id", { count: "exact", head: true })
    .ilike("human_id", `${pattern}%`);

  if (error) return formatHumanId(now, Date.now() % 100000);
  return formatHumanId(now, (count ?? 0) + 1);
}

/* ───────────── GET /api/spedizioni ───────────── */
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const q = (url.searchParams.get("q") || "").trim();
    const sort = url.searchParams.get("sort") || "created_desc";
    const page = Math.max(1, Number(url.searchParams.get("page") || 1));
    const limit = Math.min(
      100,
      Math.max(1, Number(url.searchParams.get("limit") || 20))
    );

    // ✅ CLIENT SCOPE (RLS): la lista "Le mie spedizioni" deve SEMPRE passare sotto RLS.
    // - prende l'utente dalla sessione cookie-based Supabase
    // - se non autenticato → 401
    // - nessun service role, nessun email in querystring per filtrare (anti-leak)
    const supa = supabaseServerSpst();
    const { data: userData, error: userErr } = await supa.auth.getUser();
    const userEmail = userData?.user?.email ? String(userData.user.email) : null;

    if (userErr || !userEmail) {
      return NextResponse.json(
        { ok: false, error: "UNAUTHENTICATED" },
        { status: 401, headers: withCorsHeaders() }
      );
    }

    const emailNorm = normalizeEmail(userEmail);
    if (!emailNorm) {
      return NextResponse.json(
        { ok: false, error: "UNAUTHENTICATED" },
        { status: 401, headers: withCorsHeaders() }
      );
    }

    let query = supa
      .from("shipments")
      .select(
        `
        id,created_at,human_id,email_cliente,email_norm,
        tipo_spedizione,incoterm,giorno_ritiro,
        carrier,tracking_code, 
        mittente_paese,mittente_citta,mittente_cap,mittente_indirizzo,
        dest_paese,dest_citta,dest_cap,
        colli_n,peso_reale_kg,status,
        mittente_rs,mittente_telefono,mittente_piva,
        dest_rs,dest_telefono,dest_piva,
        fatt_rs,fatt_piva,fatt_valuta,
        formato_sped,contenuto_generale,dest_abilitato_import,
        fields,
        ldv,fattura_proforma,fattura_commerciale,dle,
        allegato1,allegato2,allegato3,allegato4,
        packages:packages!packages_shipment_id_fkey(
          id,
          contenuto,
          length_cm,
          width_cm,
          height_cm,
          weight_kg,
          weight_volumetric_kg,
          weight_tariff_kg
        )
        `,
        { count: "exact" }
      );

    // ✅ ridondanza (RLS già filtra) + performance
    query = query.eq("email_norm", emailNorm);

    if (q) {
      query = query.or(
        [
          `human_id.ilike.%${q}%`,
          `tracking_code.ilike.%${q}%`,
          `carrier.ilike.%${q}%`,
          `dest_citta.ilike.%${q}%`,
          `dest_paese.ilike.%${q}%`,
          `mittente_citta.ilike.%${q}%`,
          `mittente_paese.ilike.%${q}%`,
        ].join(",")
      );
    }

    if (sort === "ritiro_desc") {
      query = query.order("giorno_ritiro", {
        ascending: false,
        nullsFirst: true,
      });
    } else if (sort === "dest_az") {
      query = query
        .order("dest_citta", { ascending: true, nullsFirst: true })
        .order("dest_paese", { ascending: true, nullsFirst: true });
    } else if (sort === "status") {
      query = query.order("status", { ascending: true, nullsFirst: true });
    } else {
      query = query.order("created_at", { ascending: false, nullsFirst: true });
    }

    const from = (page - 1) * limit;
    const to = from + limit - 1;

    const { data, error, count } = await query.range(from, to);
    if (error) throw error;

    const rows = (data || []).map((r: any) => ({
      id: r.id,
      created_at: r.created_at,
      human_id: r.human_id,
      email_cliente: r.email_cliente,
      email_norm: r.email_norm,
      tipo_spedizione: r.tipo_spedizione,
      incoterm: r.incoterm,
      giorno_ritiro: r.giorno_ritiro,
      carrier: r.carrier ?? null,
      tracking_code: r.tracking_code ?? null,
      mittente_paese: r.mittente_paese,
      mittente_citta: r.mittente_citta,
      mittente_cap: r.mittente_cap,
      mittente_indirizzo: r.mittente_indirizzo,
      dest_paese: r.dest_paese,
      dest_citta: r.dest_citta,
      dest_cap: r.dest_cap,
      colli_n: r.colli_n,
      peso_reale_kg: r.peso_reale_kg,
      status: r.status,
      mittente_rs: r.mittente_rs,
      mittente_telefono: r.mittente_telefono,
      mittente_piva: r.mittente_piva,
      dest_rs: r.dest_rs,
      dest_telefono: r.dest_telefono,
      dest_piva: r.dest_piva,
      fatt_rs: r.fatt_rs,
      fatt_piva: r.fatt_piva,
      fatt_valuta: r.fatt_valuta,
      formato_sped:
        r.formato_sped ?? r.fields?.formato ?? r.fields?.formato_sped ?? null,
      contenuto_generale: r.contenuto_generale,
      dest_abilitato_import: r.dest_abilitato_import,
      attachments: {
        ldv: normAtt(r.ldv),
        fattura_proforma: normAtt(r.fattura_proforma),
        fattura_commerciale: normAtt(r.fattura_commerciale),
        dle: normAtt(r.dle),
        allegato1: normAtt(r.allegato1),
        allegato2: normAtt(r.allegato2),
        allegato3: normAtt(r.allegato3),
        allegato4: normAtt(r.allegato4),
      },
      packages: Array.isArray(r.packages) ? r.packages : [],
    }));

    return NextResponse.json(
      { ok: true, page, limit, total: count ?? rows.length, rows },
      { headers: withCorsHeaders() }
    );
  } catch (e: any) {
    console.error("❌ [SPEDIZIONI] UNEXPECTED ERROR (GET)");
    console.error("message:", e?.message);
    console.error("stack:", e?.stack);
    return NextResponse.json(
      { ok: false, error: "UNEXPECTED_ERROR", details: String(e?.message || e) },
      { status: 500, headers: withCorsHeaders() }
    );
  }
}


/* ───────────── POST /api/spedizioni ───────────── */
export async function POST(req: Request) {
  const request_id = rid();

  try {
    console.log("──────── SPST /api/spedizioni POST ────────");
    console.log("request_id:", request_id);
    console.log("BUILD COMMIT:", process.env.VERCEL_GIT_COMMIT_SHA || "NO_SHA");
    console.log("NODE ENV:", process.env.NODE_ENV);

    // 0) read raw
    const bodyRaw = await req.json().catch(() => ({} as any));
    console.log("[SPEDIZIONI] raw body keys:", Object.keys(bodyRaw || {}).join(","));
    console.log("[SPEDIZIONI] raw email_cliente:", bodyRaw?.email_cliente);

    const SUPABASE_URL =
      process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
    const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const SUPABASE_SERVICE_ROLE_KEY =
      process.env.SUPABASE_SERVICE_ROLE || process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      const res = NextResponse.json(
        { ok: false, error: "Missing Supabase env", request_id },
        { status: 500, headers: withCorsHeaders() }
      );
      res.headers.set("x-request-id", request_id);
      return res;
    }
    if (!SUPABASE_SERVICE_ROLE_KEY) {
      const res = NextResponse.json(
        { ok: false, error: "Missing SUPABASE_SERVICE_ROLE", request_id },
        { status: 500, headers: withCorsHeaders() }
      );
      res.headers.set("x-request-id", request_id);
      return res;
    }

    // 1) AUTH (dual): cookie session (SSR) → bearer → headers
    let userEmail: string | null = null;

    // A) SSR cookie session (come /api/impostazioni)
    try {
      const supa = supabaseServerSpst();
      const { data, error } = await supa.auth.getUser();
      if (error) console.log("[SPEDIZIONI] cookie getUser error:", error.message);
      userEmail = (data?.user?.email ?? null) ? String(data.user.email) : null;
      console.log("[SPEDIZIONI] cookie session email:", userEmail);
    } catch (e: any) {
      console.log("[SPEDIZIONI] cookie getUser exception:", e?.message || e);
    }

    // B) Bearer/sb token
    if (!userEmail) {
      const auth = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        auth: { persistSession: false },
      }) as any;

      const token = getAccessTokenFromRequest();
      console.log("[SPEDIZIONI] token present:", !!token);

      if (token) {
        const { data, error } = await auth.auth.getUser(token);
        if (error) console.log("[SPEDIZIONI] bearer getUser error:", error.message);
        userEmail = (data?.user?.email ?? null) ? String(data.user.email) : null;
      }
    }

    // C) headers fallback
    if (!userEmail) {
      const hdrs = nextHeaders();
      userEmail =
        hdrs.get("x-user-email") ||
        hdrs.get("x-client-email") ||
        hdrs.get("x-auth-email") ||
        null;
      console.log("[SPEDIZIONI] header email:", userEmail);
    }

    if (!userEmail) {
      const res = NextResponse.json(
        { ok: false, error: "UNAUTHENTICATED", request_id },
        { status: 401, headers: withCorsHeaders() }
      );
      res.headers.set("x-request-id", request_id);
      return res;
    }

    // 2) inject email into body BEFORE Zod
    const email_cliente = userEmail.toLowerCase().trim();
    const body = {
      ...bodyRaw,
      email_cliente: bodyRaw?.email_cliente ? String(bodyRaw.email_cliente) : email_cliente,
    };

    console.log("[SPEDIZIONI] effective email_cliente:", body.email_cliente);

    // 3) CONTRACT (ora passa anche senza email dal frontend)
    const input = ShipmentInputZ.parse(body);

    const supabaseSrv = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    }) as any;

    const colli: any[] = Array.isArray((input as any).colli)
      ? (input as any).colli
      : [];

    const email_norm = normalizeEmail(body.email_cliente);

    if (!email_norm) {
      const res = NextResponse.json(
        {
          ok: false,
          error: "INVALID_EMAIL_CLIENTE",
          request_id,
          details: "email_cliente is required and must be a valid email",
        },
        { status: 400, headers: withCorsHeaders() }
      );
      res.headers.set("x-request-id", request_id);
      return res;
    }

    // shipments row
    const baseRow: any = {
      email_cliente: email_norm,
      email_norm,

      tipo_spedizione: (input as any).tipo_spedizione ?? null,
      incoterm: (input as any).incoterm ?? null,
      giorno_ritiro: (input as any).giorno_ritiro ?? null,
      note_ritiro: (input as any).note_ritiro ?? null,
      formato_sped: (input as any).formato_sped ?? null,
      contenuto_generale: (input as any).contenuto_generale ?? null,
      status: "CREATA",

      mittente_rs:
        (input as any).mittente_rs ?? (input as any).mittente?.rs ?? null,
      mittente_paese:
        (input as any).mittente_paese ?? (input as any).mittente?.paese ?? null,
      mittente_citta:
        (input as any).mittente_citta ?? (input as any).mittente?.citta ?? null,
      mittente_cap:
        (input as any).mittente_cap ?? (input as any).mittente?.cap ?? null,
      mittente_indirizzo:
        (input as any).mittente_indirizzo ??
        (input as any).mittente?.indirizzo ??
        null,
      mittente_telefono:
        (input as any).mittente_telefono ??
        (input as any).mittente?.telefono ??
        null,
      mittente_piva:
        (input as any).mittente_piva ?? (input as any).mittente?.piva ?? null,

      dest_rs: (input as any).dest_rs ?? (input as any).destinatario?.rs ?? null,
      dest_paese:
        (input as any).dest_paese ?? (input as any).destinatario?.paese ?? null,
      dest_citta:
        (input as any).dest_citta ?? (input as any).destinatario?.citta ?? null,
      dest_cap:
        (input as any).dest_cap ?? (input as any).destinatario?.cap ?? null,
      dest_indirizzo:
        (input as any).dest_indirizzo ??
        (input as any).destinatario?.indirizzo ??
        null,
      dest_telefono:
        (input as any).dest_telefono ??
        (input as any).destinatario?.telefono ??
        null,
      dest_piva:
        (input as any).dest_piva ?? (input as any).destinatario?.piva ?? null,
      dest_abilitato_import:
        typeof (input as any).dest_abilitato_import === "boolean"
          ? (input as any).dest_abilitato_import
          : typeof (input as any).destinatario?.abilitato_import === "boolean"
          ? (input as any).destinatario.abilitato_import
          : null,

      fatt_rs: (input as any).fatt_rs ?? (input as any).fatturazione?.rs ?? null,
      fatt_piva:
        (input as any).fatt_piva ?? (input as any).fatturazione?.piva ?? null,
      fatt_valuta:
        (input as any).fatt_valuta ??
        (input as any).fatturazione?.valuta ??
        null,

      fields: (input as any).extras ?? null,
    };

    console.log("[SPEDIZIONI] baseRow email_norm:", email_norm);
    console.log("[SPEDIZIONI] baseRow keys:", Object.keys(baseRow));


    // human_id retry
    let shipment: any = null;
    const MAX_RETRY = 6;
    let attempt = 0;
    let lastErr: any = null;

    while (attempt < MAX_RETRY) {
      attempt++;
      const human_id = await nextHumanIdForToday(supabaseSrv);
      const insertRow = { ...baseRow, human_id };

      const ins = await (supabaseSrv as any)
        .schema("spst")
        .from("shipments")
        .insert(insertRow)
        .select("id,human_id,email_cliente,email_norm,created_at,giorno_ritiro,carrier,tracking_code")
        .single();

      const { data, error } = ins;

      

      console.log(
        `[SPEDIZIONI] insert attempt=${attempt} human_id=${human_id} error=${error?.message ?? null} data=${safeJson(
          data,
          2000
        )}`
      );

      if (!error) {
        shipment = data;
        break;
      }

      if (error.code === "23505" || /unique/i.test(error.message)) {
        lastErr = error;
        continue;
      }

      lastErr = error;
      break;
    }

    if (!shipment) {
      const res = NextResponse.json(
        {
          ok: false,
          error: "INSERT_FAILED",
          request_id,
          details: lastErr?.message || String(lastErr),
        },
        { status: 500, headers: withCorsHeaders() }
      );
      res.headers.set("x-request-id", request_id);
      return res;
    }

// ✅ Best-effort email: non deve mai rompere la creazione spedizione
try {
  const resendKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_NOREPLY_FROM;

  if (resendKey && from) {
    const resend = new Resend(resendKey);

    const to = (shipment.email_cliente || shipment.email_norm || "")
      .toString()
      .trim()
      .toLowerCase();

    if (to) {
      const humanId = shipment.human_id || shipment.id;

      const { subject, html } = buildSpedizionePrenotataHtml({
        humanId,
        pickupDate: shipment.giorno_ritiro ?? null,
        carrier: shipment.carrier ?? null,
        tracking: shipment.tracking_code ?? null,
      });

      await resend.emails.send({ from, to, subject, html });
    }
  }
} catch (e) {
  console.error("[api/spedizioni] booking email failed (non-blocking)", e);
}
    

    // packages insert
    if (colli.length > 0) {
      const pkgs = colli.map((c: any) => {
        const length_cm = toNum(c?.length_cm ?? c?.lato1_cm ?? c?.l1);
        const width_cm = toNum(c?.width_cm ?? c?.lato2_cm ?? c?.l2);
        const height_cm = toNum(c?.height_cm ?? c?.lato3_cm ?? c?.l3);

        const weight_kg = toNum(
          c?.weight_kg ?? c?.peso ?? c?.peso_kg ?? c?.peso_reale_kg
        );

        const volumetric_divisor =
          toNum(c?.volumetric_divisor ?? c?.divisor) ?? 4000;

        return {
          shipment_id: shipment.id,
          contenuto: c?.contenuto ?? null,
          length_cm,
          width_cm,
          height_cm,
          weight_kg,
          volumetric_divisor,
        };
      });

      const { error: pkgErr } = await (supabaseSrv as any)
        .schema("spst")
        .from("packages")
        .insert(pkgs);

      if (pkgErr) {
        const res = NextResponse.json(
          {
            ok: false,
            error: "PACKAGES_INSERT_FAILED",
            request_id,
            details: (pkgErr as any).message,
            shipment_id: shipment.id,
          },
          { status: 500, headers: withCorsHeaders() }
        );
        res.headers.set("x-request-id", request_id);
        return res;
      }
    }

    const res = NextResponse.json(
      { ok: true, request_id, shipment, id: shipment.human_id || shipment.id },
      { headers: withCorsHeaders() }
    );
    res.headers.set("x-request-id", request_id);
    return res;
  } catch (e: any) {
    console.error("❌ [SPEDIZIONI] UNEXPECTED ERROR (POST)");
    console.error("request_id:", request_id);
    console.error("message:", e?.message);
    console.error("stack:", e?.stack);

    const res = NextResponse.json(
      {
        ok: false,
        error: "UNEXPECTED_ERROR",
        request_id,
        details: String(e?.message || e),
      },
      { status: 500, headers: withCorsHeaders() }
    );
    res.headers.set("x-request-id", request_id);
    return res;
  }
}
