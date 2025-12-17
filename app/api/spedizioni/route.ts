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

const toNum = (x: any): number | null => {
  if (x === null || x === undefined) return null;
  const n = Number(String(x).replace(",", ".").trim());
  return Number.isFinite(n) ? n : null;
};

function firstNonEmpty(...vals: (string | undefined | null)[]) {
  for (const v of vals) if (v && String(v).trim() !== "") return String(v).trim();
  return "";
}

function normalizeEmail(x?: string | null) {
  const v = (x ?? "").trim();
  return v ? v.toLowerCase() : null;
}

function toISODate(d?: string | null): string | null {
  if (!d) return null;
  const s = d.trim();
  const m1 = /^(\d{2})[-\/](\d{2})[-\/](\d{4})$/.exec(s);
  if (m1) {
    const [_, dd, mm, yyyy] = m1;
    return `${yyyy}-${mm}-${dd}`;
  }
  const m2 = /^(\d{4})[-\/](\d{2})[-\/](\d{2})$/.exec(s);
  if (m2) return s.substring(0, 10);
  const t = Date.parse(s);
  if (!isNaN(t)) return new Date(t).toISOString().slice(0, 10);
  return null;
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

const att = (x: any) => {
  if (!x) return null;
  if (typeof x === "string") return { url: x };
  if (typeof x.url === "string" && x.url.trim()) {
    const o: any = { url: String(x.url).trim() };
    if (x.filename) o.filename = String(x.filename);
    if (x.mime) o.mime = String(x.mime);
    return o;
  }
  return null;
};

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
  const supaAny = supabaseSrv as any;
  const { count, error } = await supaAny
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
    const emailParam = url.searchParams.get("email");

    const SUPABASE_URL =
      process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
    const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      return NextResponse.json(
        { ok: false, error: "Missing Supabase env" },
        { status: 500 }
      );
    }
    const auth = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: false },
    }) as any;

    let emailNorm: string | null = normalizeEmail(emailParam);
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
  packages:packages!packages_shipment_id_fkey(id,l1,l2,l3,weight_kg)
  `,
        { count: "exact" }
      );

    if (emailNorm) query = query.eq("email_norm", emailNorm);

    if (q) {
      query = query.or(
        [
          `human_id.ilike.%${q}%`,
          `tracking_code.ilike.%${q}%`, // ✅ NEW
          `carrier.ilike.%${q}%`, // ✅ NEW
          `dest_citta.ilike.%${q}%`,
          `dest_paese.ilike.%${q}%`,
          `mittente_citta.ilike.%${q}%`,
          `mittente_paese.ilike.%${q}%`,
        ].join(",")
      );
    }

    if (sort === "ritiro_desc")
      query = query.order("giorno_ritiro", {
        ascending: false,
        nullsFirst: true,
      });
    else if (sort === "dest_az")
      query = query
        .order("dest_citta", { ascending: true, nullsFirst: true })
        .order("dest_paese", { ascending: true, nullsFirst: true });
    else if (sort === "status")
      query = query.order("status", { ascending: true, nullsFirst: true });
    else
      query = query.order("created_at", {
        ascending: false,
        nullsFirst: true,
      });

    const from = (page - 1) * limit;
    const to = from + limit - 1;
    const { data, error, count } = await query.range(from, to);
    if (error) throw error;

    const normAtt = (j: any) => (j && typeof j.url === "string" ? j : null);

    const rows = (data || []).map((r: any) => ({
      id: r.id,
      created_at: r.created_at,
      human_id: r.human_id,
      email_cliente: r.email_cliente,
      email_norm: r.email_norm,

      tipo_spedizione: r.tipo_spedizione,
      incoterm: r.incoterm,
      giorno_ritiro: r.giorno_ritiro,

      // ✅ NEW
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

    return NextResponse.json({
      ok: true,
      page,
      limit,
      total: count ?? rows.length,
      rows,
    });
  } catch (e: any) {
    console.error("[API/spedizioni:GET] unexpected:", e);
    return NextResponse.json(
      { ok: false, error: String(e?.message || e) },
      { status: 500 }
    );
  }
}

/* ───────────── POST /api/spedizioni ───────────── */
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({} as any));

    const SUPABASE_URL =
      process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
    const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const SUPABASE_SERVICE_ROLE_KEY =
      process.env.SUPABASE_SERVICE_ROLE || process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      throw new Error(
        "Missing NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY."
      );
    }
    if (!SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error(
        "Missing SUPABASE_SERVICE_ROLE (or SUPABASE_SERVICE_ROLE_KEY)."
      );
    }

    const supabaseAuth = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: false },
    });
    const supabaseSrv = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });
    const supaAny = supabaseSrv as any;

    // ── USER / EMAIL ──────────────────────────────────────────────
    const accessToken = getAccessTokenFromRequest();
    const { data: userData } = accessToken
      ? await supabaseAuth.auth.getUser(accessToken)
      : ({ data: { user: null } } as any);

    const hdrs = nextHeaders();
    const emailFromHeaders =
      hdrs.get("x-user-email") ||
      hdrs.get("x-client-email") ||
      hdrs.get("x-auth-email") ||
      null;

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

    // ── PARTY / COLLIS ────────────────────────────────────────────
    const mitt: Party = body.mittente ?? {};
    const dest: Party = body.destinatario ?? {};
    const fatt: Party = body.fatturazione ?? body.fatt ?? {};

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
    const peso_reale_kg =
      pesoTot > 0 ? Number(pesoTot.toFixed(3)) : toNum(body.peso_reale_kg);

    const giorno_ritiro = toISODate(body.ritiroData ?? body.giorno_ritiro);
    const incoterm =
      firstNonEmpty(body.incoterm, body.incoterm_norm).toUpperCase() || null;
    const tipo_spedizione =
      firstNonEmpty(body.tipoSped, body.tipo_spedizione) || null;
    const dest_abilitato_import =
      typeof body.destAbilitato === "boolean"
        ? body.destAbilitato
        : typeof body.dest_abilitato_import === "boolean"
        ? body.dest_abilitato_import
        : null;
    const note_ritiro = body.ritiroNote ?? body.note_ritiro ?? null;

    // ── Mittente normalizzato ─────────────────────────────────────
    const mittente_paese = mitt.paese ?? body.mittente_paese ?? null;
    const mittente_citta = mitt.citta ?? body.mittente_citta ?? null;
    const mittente_cap = mitt.cap ?? body.mittente_cap ?? null;
    const mittente_indirizzo =
      mitt.indirizzo ?? body.mittente_indirizzo ?? null;

    const mittente_rs =
      mitt.ragioneSociale ??
      (mitt as any).ragione_sociale ??
      body.mittente_rs ??
      body.mittente_ragione ??
      body.mittente_ragione_sociale ??
      null;

    const mittente_telefono = mitt.telefono ?? body.mittente_telefono ?? null;

    const mittente_piva = mitt.piva ?? body.mittente_piva ?? null;

    // ── Destinatario normalizzato ─────────────────────────────────
    const dest_paese = dest.paese ?? body.dest_paese ?? null;
    const dest_citta = dest.citta ?? body.dest_citta ?? null;
    const dest_cap = dest.cap ?? body.dest_cap ?? null;

    const dest_rs =
      dest.ragioneSociale ??
      (dest as any).ragione_sociale ??
      body.dest_rs ??
      body.dest_ragione ??
      body.dest_ragione_sociale ??
      null;

    const dest_telefono = dest.telefono ?? body.dest_telefono ?? null;
    const dest_piva = dest.piva ?? body.dest_piva ?? null;

    // ── Fatturazione normalizzata ─────────────────────────────────
    const fatt_rs =
      fatt.ragioneSociale ??
      (fatt as any).ragione_sociale ??
      body.fatt_rs ??
      body.fatt_ragione ??
      body.fatt_ragione_sociale ??
      null;

    const fatt_piva = fatt.piva ?? body.fatt_piva ?? null;
    const fatt_valuta =
      (fatt as any).valuta ?? body.fatt_valuta ?? body.valuta ?? null;

    // ── Attachments (legacy JSON in tabella) ──────────────────────
    const attachments = body.attachments ?? body.allegati ?? {};
    const ldv = att(attachments.ldv ?? body.ldv);
    const fattura_proforma = att(
      attachments.fattura_proforma ?? body.fattura_proforma
    );
    const fattura_commerciale = att(
      attachments.fattura_commerciale ?? body.fattura_commerciale
    );
    const dle = att(attachments.dle ?? body.dle);
    const allegato1 = att(attachments.allegato1 ?? body.allegato1);
    const allegato2 = att(attachments.allegato2 ?? body.allegato2);
    const allegato3 = att(attachments.allegato3 ?? body.allegato3);
    const allegato4 = att(attachments.allegato4 ?? body.allegato4);

    // ── Assicurazione (NEW) ───────────────────────────────────────
    const insuranceRequested = Boolean(
      body.assicurazioneAttiva ??
        body.assicurazione_pallet ??
        body.insurance_requested ??
        body?.fields?.insurance_requested
    );

    // Se hai un campo valore assicurato nel form, leggilo qui.
    // Supportiamo vari alias per non vincolarti lato client.
    const insuranceValueEur =
      toNum(
        body.valoreAssicurato ??
          body.valore_assicurato ??
          body.insurance_value_eur ??
          body.insuranceValueEur
      ) ?? null;

    // ── Fields “raw” salvati in JSONB ─────────────────────────────
    const fieldsSafe = (() => {
      const clone: any = JSON.parse(JSON.stringify(body ?? {}));
      const blocklist = [
        "colli_n",
        "colli",
        "peso_reale_kg",
        "giorno_ritiro",
        "incoterm",
        "incoterm_norm",
        "tipoSped",
        "tipo_spedizione",
        "dest_abilitato_import",
        "mittente_paese",
        "mittente_citta",
        "mittente_cap",
        "mittente_indirizzo",
        "dest_paese",
        "dest_citta",
        "dest_cap",
        "email",
        "email_cliente",
        "email_norm",
        "carrier",
        "service_code",
        "pickup_at",
        "tracking_code",
        "declared_value",
        "status",
        "human_id",
        "ldv",
        "fattura_proforma",
        "fattura_commerciale",
        "dle",
        "allegato1",
        "allegato2",
        "allegato3",
        "allegato4",
        "attachments",
        "allegati",
      ];
      for (const k of blocklist) delete clone[k];
      return clone;
    })();

    // Salviamo sempre i flag assicurazione nel JSONB
    (fieldsSafe as any).insurance_requested = insuranceRequested;
    (fieldsSafe as any).insurance_value_eur = insuranceValueEur;

    // ── Row principale per spst.shipments ─────────────────────────
    const baseRow: any = {
      email_cliente: emailRaw || null,
      email_norm: emailNorm,

      mittente_paese,
      mittente_citta,
      mittente_cap,
      mittente_indirizzo,
      mittente_rs,
      mittente_telefono,
      mittente_piva,

      dest_paese,
      dest_citta,
      dest_cap,
      dest_rs,
      dest_telefono,
      dest_piva,

      fatt_rs,
      fatt_piva,
      fatt_valuta,

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
      declared_value: insuranceRequested
        ? (insuranceValueEur ?? toNum(body.declared_value))
        : toNum(body.declared_value),
      status: body.status ?? "draft",

      fields: fieldsSafe,

      ldv,
      fattura_proforma,
      fattura_commerciale,
      dle,
      allegato1,
      allegato2,
      allegato3,
      allegato4,
    };

    // ── Genera human_id con retry su unique ───────────────────────
    let shipment: any = null;
    const MAX_RETRY = 6;
    let attempt = 0;
    let lastErr: any = null;

    while (attempt < MAX_RETRY) {
      attempt++;
      const human_id = await nextHumanIdForToday(supabaseSrv);
      const insertRow = { ...baseRow, human_id };

      const { data, error } = await (supaAny as any)
        .schema("spst")
        .from("shipments")
        .insert(insertRow)
        .select()
        .single();

      if (!error) {
        shipment = data;
        break;
      }
      if (error.code === "23505" || /unique/i.test(error.message)) {
        lastErr = error;
        continue;
      } else {
        lastErr = error;
        break;
      }
    }

    if (!shipment) {
      console.error("[API/spedizioni] insert error:", lastErr);
      return NextResponse.json(
        {
          ok: false,
          error: "INSERT_FAILED",
          details: lastErr?.message || String(lastErr),
        },
        { status: 500, headers: { "Access-Control-Allow-Origin": "*" } }
      );
    }

    // ── Insert colli in spst.packages ─────────────────────────────
    if (Array.isArray(colli) && colli.length > 0) {
      const pkgs = colli.map((c) => ({
        shipment_id: shipment.id,
        l1: toNum(c.l1 ?? c.lunghezza_cm),
        l2: toNum(c.l2 ?? c.larghezza_cm),
        l3: toNum(c.l3 ?? c.altezza_cm),
        weight_kg: toNum(c.peso ?? c.peso_kg),
        fields: c,
      }));
      const { error: pkgErr } = await (supaAny as any)
        .schema("spst")
        .from("packages")
        .insert(pkgs);
      if (pkgErr)
        console.warn("[API/spedizioni] packages insert warning:", pkgErr.message);
    }

    const res = NextResponse.json({
      ok: true,
      shipment,
      id: shipment.human_id || shipment.id,
    });
    res.headers.set("Access-Control-Allow-Origin", "*");
    return res;
  } catch (e: any) {
    console.error("[API/spedizioni] unexpected:", e);
    return NextResponse.json(
      {
        ok: false,
        error: "UNEXPECTED_ERROR",
        details: String(e?.message || e),
      },
      { status: 500, headers: { "Access-Control-Allow-Origin": "*" } }
    );
  }
}
