// FILE: app/api/backoffice/shipments/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireStaff } from "@/lib/auth/requireStaff";
import { ShipmentInputZ } from "@/lib/contracts/shipment";

import crypto from "crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

function rid() {
  return crypto.randomUUID();
}

const toNum = (x: any): number | null => {
  if (x === null || x === undefined) return null;
  const n = Number(String(x).replace(",", ".").trim());
  return Number.isFinite(n) ? n : null;
};

function normalizeEmail(x?: string | null) {
  const v = (x ?? "").trim();
  return v ? v.toLowerCase() : null;
}

function withCorsHeaders(init?: HeadersInit) {
  return {
    ...(init || {}),
    "Access-Control-Allow-Origin": "*",
  } as Record<string, string>;
}

function admin() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE || process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) throw new Error("Missing SUPABASE_URL/SERVICE_ROLE");

  return createClient(url, key, { auth: { persistSession: false } }) as any;
}

function normAtt(j: any) {
  return j && typeof j.url === "string" ? j : null;
}

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

async function nextHumanIdForToday(sb: any): Promise<string> {
  const now = new Date();
  const dd = String(now.getUTCDate()).padStart(2, "0");
  const mm = String(now.getUTCMonth() + 1).padStart(2, "0");
  const yyyy = now.getUTCFullYear();
  const pattern = `SP-${dd}-${mm}-${yyyy}-`;

  const { count, error } = await sb
    .schema("spst")
    .from("shipments")
    .select("human_id", { count: "exact", head: true })
    .ilike("human_id", `${pattern}%`);

  if (error) return formatHumanId(now, Date.now() % 100000);
  return formatHumanId(now, (count ?? 0) + 1);
}

/* ───────────── GET /api/backoffice/shipments ───────────── */
export async function GET(req: Request) {
  try {
    const staff = await requireStaff();
    if (!staff.ok) return staff.response;

    const url = new URL(req.url);
    const q = (url.searchParams.get("q") || "").trim();
    const sort = url.searchParams.get("sort") || "created_desc";
    const limit = Math.min(
      500,
      Math.max(1, Number(url.searchParams.get("limit") || 200))
    );

    const sb = admin();

    let query = sb
      .schema("spst")
      .from("shipments")
      .select(
        `
        id,created_at,human_id,
        email_cliente,email_norm,
        tipo_spedizione,
        mittente_paese,mittente_citta,
        dest_paese,dest_citta,
        colli_n,formato_sped,
        carrier,tracking_code,
        status,
        giorno_ritiro,
        ldv,fattura_proforma,fattura_commerciale,dle,
        allegato1,allegato2,allegato3,allegato4
        `
      )
      .limit(limit);

    if (q) {
      const like = `%${q}%`;
      query = query.or(
        [
          `human_id.ilike.${like}`,
          `email_cliente.ilike.${like}`,
          `email_norm.ilike.${like}`,
          `mittente_citta.ilike.${like}`,
          `mittente_paese.ilike.${like}`,
          `dest_citta.ilike.${like}`,
          `dest_paese.ilike.${like}`,
          `carrier.ilike.${like}`,
          `tracking_code.ilike.${like}`,
        ].join(",")
      );
    }

    if (sort === "created_asc") {
      query = query.order("created_at", { ascending: true, nullsFirst: true });
    } else {
      query = query.order("created_at", { ascending: false, nullsFirst: true });
    }

    const { data, error } = await query;
    if (error) throw error;

    const rows = (data || []).map((r: any) => ({
      id: r.id,
      created_at: r.created_at,
      human_id: r.human_id,
      email_cliente: r.email_cliente,
      email_norm: r.email_norm,
      tipo_spedizione: r.tipo_spedizione,
      mittente_paese: r.mittente_paese,
      mittente_citta: r.mittente_citta,
      dest_paese: r.dest_paese,
      dest_citta: r.dest_citta,
      colli_n: r.colli_n,
      formato_sped: r.formato_sped,
      carrier: r.carrier ?? null,
      tracking_code: r.tracking_code ?? null,
      status: r.status ?? null,
      giorno_ritiro: r.giorno_ritiro ?? null,
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
    }));

    return NextResponse.json({ ok: true, rows }, { headers: withCorsHeaders() });
  } catch (e: any) {
    if (e instanceof Response) return e;

    console.error("❌ [backoffice/shipments] GET error:", e?.message || e);
    return NextResponse.json(
      { ok: false, error: "UNEXPECTED_ERROR", details: String(e?.message || e) },
      { status: 500, headers: withCorsHeaders() }
    );
  }
}

/* ───────────── POST /api/backoffice/shipments ───────────── */
export async function POST(req: Request) {
  const request_id = rid();

  try {
    await requireStaff();

    const bodyRaw = await req.json().catch(() => ({} as any));
    const as_email = normalizeEmail(bodyRaw?.as_email);

    if (!as_email) {
      const res = NextResponse.json(
        { ok: false, error: "MISSING_AS_EMAIL", request_id },
        { status: 400, headers: withCorsHeaders() }
      );
      res.headers.set("x-request-id", request_id);
      return res;
    }

    // ✅ enforce email from as_email, ignore any email_cliente in payload
    const body: any = {
      ...bodyRaw,
      email_cliente: as_email,
    };
    delete body.as_email;

    // ✅ validate contract
    const input = ShipmentInputZ.parse(body);

    const sb = admin();

    const colli: any[] = Array.isArray((input as any).colli)
      ? (input as any).colli
      : [];

    const email_norm = normalizeEmail((input as any).email_cliente);
    if (!email_norm) {
      const res = NextResponse.json(
        {
          ok: false,
          error: "INVALID_EMAIL_CLIENTE",
          request_id,
          details: "email_cliente must be a valid email",
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

    // human_id retry
    let shipment: any = null;
    const MAX_RETRY = 6;
    let attempt = 0;
    let lastErr: any = null;

    while (attempt < MAX_RETRY) {
      attempt++;
      const human_id = await nextHumanIdForToday(sb);
      const insertRow = { ...baseRow, human_id };

      const ins = await sb
        .schema("spst")
        .from("shipments")
        .insert(insertRow)
        .select("id,human_id")
        .single();

      const { data, error } = ins;

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

      const { error: pkgErr } = await sb
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
      {
        ok: true,
        request_id,
        id: shipment.human_id,
        shipment: { id: shipment.id, human_id: shipment.human_id },
      },
      { headers: withCorsHeaders() }
    );
    res.headers.set("x-request-id", request_id);
    return res;
  } catch (e: any) {
    if (e instanceof Response) return e;

    console.error("❌ [backoffice/shipments] POST error:", e?.message || e);
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
