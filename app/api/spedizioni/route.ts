// app/api/spedizioni/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { cookies, headers as nextHeaders } from "next/headers";
import { ShipmentInputZ } from "@/lib/contracts/shipment";

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

/* ───────────── GET /api/spedizioni ─────────────
   ✅ packages columns allineate allo schema reale (length_cm/width_cm/height_cm/weight_kg)
*/
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
    const emailParam = url.searchParams.get("email");

    const SUPABASE_URL =
      process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
    const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      return NextResponse.json(
        { ok: false, error: "Missing Supabase env" },
        { status: 500, headers: withCorsHeaders() }
      );
    }

    // auth client (anon) per risolvere email da token
    const auth = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: false },
    }) as any;

    let emailNorm: string | null = normalizeEmail(emailParam);

    // se non arriva ?email=..., prova a recuperare da token/cookie/header
    if (!emailNorm) {
      const token = getAccessTokenFromRequest();
      if (token) {
        const { data } = await auth.auth.getUser(token);
        emailNorm = normalizeEmail(data?.user?.email ?? null);
      }
      if (!emailNorm) {
        const hdrs = nextHeaders();
        emailNorm = normalizeEmail(
          hdrs.get("x-user-email") ||
            hdrs.get("x-client-email") ||
            hdrs.get("x-auth-email")
        );
      }
    }

    // server-side: preferisci service role se presente
    const srvKey =
      process.env.SUPABASE_SERVICE_ROLE || process.env.SUPABASE_SERVICE_ROLE_KEY;

    const supa = createClient(SUPABASE_URL, srvKey || SUPABASE_ANON_KEY, {
      auth: { persistSession: false },
    }) as any;

    let query = supa
      .schema("spst")
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

    if (emailNorm) query = query.eq("email_norm", emailNorm);

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
      {
        ok: true,
        page,
        limit,
        total: count ?? rows.length,
        rows,
      },
      { headers: withCorsHeaders() }
    );
  } catch (e: any) {
    console.error("❌ [SPEDIZIONI] UNEXPECTED ERROR (GET)");
    console.error("message:", e?.message);
    console.error("stack:", e?.stack);
    console.error("raw:", e);

    return NextResponse.json(
      {
        ok: false,
        error: "UNEXPECTED_ERROR",
        details: String(e?.message || e),
      },
      { status: 500, headers: withCorsHeaders() }
    );
  }
}

/* ───────────── POST /api/spedizioni ─────────────
   ✅ insert packages con mapping robusto:
   - preferisce length_cm/width_cm/height_cm/weight_kg
   - fallback su latoX_cm/peso_reale_kg (legacy)
*/
export async function POST(req: Request) {
  try {
    console.log("──────── SPST /api/spedizioni POST ────────");
    console.log("BUILD COMMIT:", process.env.VERCEL_GIT_COMMIT_SHA || "NO_SHA");
    console.log("NODE ENV:", process.env.NODE_ENV);

    const body = await req.json().catch(() => ({} as any));

    // ✅ CONTRACT
    const input = ShipmentInputZ.parse(body);

    const SUPABASE_URL =
      process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
    const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const SUPABASE_SERVICE_ROLE_KEY =
      process.env.SUPABASE_SERVICE_ROLE || process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      return NextResponse.json(
        { ok: false, error: "Missing Supabase env" },
        { status: 500, headers: withCorsHeaders() }
      );
    }
    if (!SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json(
        { ok: false, error: "Missing SUPABASE_SERVICE_ROLE" },
        { status: 500, headers: withCorsHeaders() }
      );
    }

    const supabaseSrv = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    }) as any;

    const colli: any[] = Array.isArray((input as any).colli)
      ? (input as any).colli
      : [];

    const email_norm = normalizeEmail((input as any).email_cliente);

    // ✅ shipments: insert (no calcoli peso/colli qui)
    const baseRow: any = {
      email_cliente: (input as any).email_cliente ?? null,
      email_norm,

      tipo_spedizione: (input as any).tipo_spedizione ?? null,
      incoterm: (input as any).incoterm ?? null,
      giorno_ritiro: (input as any).giorno_ritiro ?? null,
      note_ritiro: (input as any).note_ritiro ?? null,
      formato_sped: (input as any).formato_sped ?? null,
      contenuto_generale: (input as any).contenuto_generale ?? null,

      // ⚠️ mapping party: supporta sia shape flat che nested
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

      // ✅ extras
      fields: (input as any).extras ?? null,
    };

    console.log("[SPEDIZIONI] Insert shipments → schema: spst");
    console.log("[SPEDIZIONI] Shipments payload keys:", Object.keys(baseRow));

    // ✅ human_id retry (evita collisioni)
    let shipment: any = null;
    const MAX_RETRY = 6;
    let attempt = 0;
    let lastErr: any = null;

    while (attempt < MAX_RETRY) {
      attempt++;
      const human_id = await nextHumanIdForToday(supabaseSrv);
      const insertRow = { ...baseRow, human_id };

      const { data, error } = await supabaseSrv
        .schema("spst")
        .from("shipments")
        .insert(insertRow)
        .select()
        .single();

      if (!error) {
        shipment = data;
        break;
      }

      // unique collision -> retry
      if (error.code === "23505" || /unique/i.test(error.message)) {
        lastErr = error;
        continue;
      }

      lastErr = error;
      break;
    }

    if (!shipment) {
      console.error("[SPEDIZIONI] INSERT shipments FAILED");
      console.error("code:", lastErr?.code);
      console.error("message:", lastErr?.message);
      console.error("details:", lastErr?.details);
      console.error("hint:", lastErr?.hint);
      console.error("raw:", lastErr);

      return NextResponse.json(
        {
          ok: false,
          error: "INSERT_FAILED",
          details: lastErr?.message || String(lastErr),
        },
        { status: 500, headers: withCorsHeaders() }
      );
    }

    // ✅ packages: schema reale (length_cm/width_cm/height_cm/weight_kg)
if (colli.length > 0) {
  const pkgs = colli.map((c: any) => {
    // WHITELIST hard: nessuna key "random" può entrare in insert
    const length_cm = toNum(c?.length_cm ?? c?.lato1_cm ?? c?.l1);
    const width_cm  = toNum(c?.width_cm  ?? c?.lato2_cm ?? c?.l2);
    const height_cm = toNum(c?.height_cm ?? c?.lato3_cm ?? c?.l3);

    // input legacy ok, ma colonna DB è weight_kg
    const weight_kg = toNum(c?.weight_kg ?? c?.peso ?? c?.peso_kg ?? c?.peso_reale_kg);

    const volumetric_divisor =
  toNum(c?.volumetric_divisor ?? c?.divisor) ?? null;


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

  // 🔍 DEBUG: cosa stiamo davvero inserendo?
  console.log("[SPEDIZIONI] packages target = spst.packages");
  console.log("[SPEDIZIONI] pkgs[0] keys =", Object.keys(pkgs?.[0] ?? {}));
  console.log("[SPEDIZIONI] pkgs[0] =", JSON.stringify(pkgs?.[0] ?? null));

  const { error: pkgErr } = await supabaseSrv
    .schema("spst")
    .from("packages")
    .insert(pkgs);

  if (pkgErr) {
    console.error("[SPEDIZIONI] PACKAGES INSERT FAILED");
    console.error("code:", (pkgErr as any)?.code);
    console.error("message:", (pkgErr as any)?.message);
    console.error("details:", (pkgErr as any)?.details);
    console.error("hint:", (pkgErr as any)?.hint);
    console.error("raw:", pkgErr);

    return NextResponse.json(
      {
        ok: false,
        error: "PACKAGES_INSERT_FAILED",
        details: (pkgErr as any).message,
        shipment_id: shipment.id,
      },
      { status: 500, headers: withCorsHeaders() }
    );
  }
}

return NextResponse.json(
  {
    ok: true,
    shipment,
    id: shipment.human_id || shipment.id,
  },
  { headers: withCorsHeaders() }
);