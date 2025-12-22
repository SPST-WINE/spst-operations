// app/api/spedizioni/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabaseServerSpst } from "@/lib/supabase/server";
import { requireStaff } from "@/lib/auth/requireStaff";

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
  if (!s) return null;

  const m1 = s.match(/^(\d{2})[/-](\d{2})[/-](\d{4})$/);
  if (m1) return `${m1[3]}-${m1[2]}-${m1[1]}`;

  const m2 = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m2) return s;

  const dt = new Date(s);
  if (!Number.isNaN(dt.getTime())) return dt.toISOString().slice(0, 10);

  return null;
}

function toNum(x: any): number | null {
  if (x === null || x === undefined) return null;
  const n = Number(x);
  return Number.isFinite(n) ? n : null;
}

function att(raw: any) {
  if (!raw) return null;
  if (typeof raw === "string") return { url: raw };
  if (typeof raw === "object") return raw;
  return null;
}

/** service-role client */
function admin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE || process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) throw new Error("Missing SUPABASE_URL/SERVICE_ROLE");
  return createClient(url, key, { auth: { persistSession: false } }) as any;
}

/** staff check (cookie-based, no header spoofing) */
async function isStaff(): Promise<boolean> {
  const supa = supabaseServerSpst();
  const { data } = await supa.auth.getUser();
  const user = data?.user;
  if (!user?.id || !user?.email) return false;

  const email = user.email.toLowerCase().trim();
  if (email === "info@spst.it") return true;

  const { data: staff } = await supa
    .from("staff_users")
    .select("role, enabled")
    .eq("user_id", user.id)
    .maybeSingle();

  const enabled =
    typeof (staff as any)?.enabled === "boolean" ? (staff as any).enabled : true;

  const role = String((staff as any)?.role || "").toLowerCase().trim();
  return enabled && (role === "admin" || role === "staff" || role === "operator");
}

/* ───────────── human_id generator (DEFINITIVO) ───────────── */
function formatHumanId(d: Date, n: number) {
  // usa UTC per coerenza (come il tuo vecchio file)
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

/* ───────────── GET /api/spedizioni ─────────────
   - CLIENT: via RLS
   - STAFF: service role (vede tutto)
*/
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const q = (url.searchParams.get("q") || "").trim();
    const sort = url.searchParams.get("sort") || "created_desc";
    const page = Math.max(1, Number(url.searchParams.get("page") || 1));
    const limit = Math.min(100, Math.max(1, Number(url.searchParams.get("limit") || 20)));
    const emailParam = normalizeEmail(url.searchParams.get("email"));
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    const supa = supabaseServerSpst();
    const {
      data: { user },
    } = await supa.auth.getUser();

    if (!user?.id) {
      return NextResponse.json({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });
    }

    const staff = await isStaff();

    // STAFF MODE
    if (staff) {
      const supaAdmin = admin();
      let query = supaAdmin
        .schema("spst")
        .from("shipments")
        .select(
          `
          id,created_at,human_id,
          email_cliente,email_norm,
          tipo_spedizione,incoterm,status,
          mittente_paese,mittente_citta,
          dest_paese,dest_citta,
          colli_n,formato_sped,
          carrier,tracking_code
        `,
          { count: "exact" }
        );

      if (emailParam) query = query.eq("email_norm", emailParam);

      if (q) {
        const safe = q.replace(/[%_]/g, "");
        const pattern = `%${safe}%`;
        query = query.or(
          [
            `human_id.ilike.${pattern}`,
            `email_cliente.ilike.${pattern}`,
            `mittente_citta.ilike.${pattern}`,
            `dest_citta.ilike.${pattern}`,
            `tracking_code.ilike.${pattern}`,
            `carrier.ilike.${pattern}`,
          ].join(",")
        );
      }

      query =
        sort === "created_asc"
          ? query.order("created_at", { ascending: true })
          : query.order("created_at", { ascending: false });

      const { data, error, count } = await query.range(from, to);
      if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

      return NextResponse.json({
        ok: true,
        page,
        limit,
        total: count ?? null,
        rows: data ?? [],
        scope: "staff",
      });
    }

    // CLIENT MODE (RLS)
    let query = supa
      .from("shipments")
      .select(
        `
        id,created_at,human_id,
        email_cliente,email_norm,
        tipo_spedizione,incoterm,status,
        mittente_paese,mittente_citta,
        dest_paese,dest_citta,
        colli_n,formato_sped,
        carrier,tracking_code
      `,
        { count: "exact" }
      );

    if (q) {
      const safe = q.replace(/[%_]/g, "");
      const pattern = `%${safe}%`;
      query = query.or(
        [
          `human_id.ilike.${pattern}`,
          `mittente_citta.ilike.${pattern}`,
          `dest_citta.ilike.${pattern}`,
          `tracking_code.ilike.${pattern}`,
          `carrier.ilike.${pattern}`,
        ].join(",")
      );
    }

    query =
      sort === "created_asc"
        ? query.order("created_at", { ascending: true })
        : query.order("created_at", { ascending: false });

    const { data, error, count } = await query.range(from, to);
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

    return NextResponse.json({
      ok: true,
      page,
      limit,
      total: count ?? null,
      rows: data ?? [],
      scope: "client",
    });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: "UNEXPECTED_ERROR", details: String(e?.message || e) },
      { status: 500 }
    );
  }
}

/* ───────────── POST /api/spedizioni ─────────────
   - CLIENT: crea solo per sé (email dalla session)
   - STAFF: può creare per altri (email dal body)
*/
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({} as any));

    const supa = supabaseServerSpst();
    const {
      data: { user },
    } = await supa.auth.getUser();

    if (!user?.id || !user?.email) {
      return NextResponse.json({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });
    }

    const staff = await isStaff();

    const emailTarget = staff
      ? normalizeEmail(
          firstNonEmpty(body.email_cliente, body.email, body?.mittente?.email, body?.fatturazione?.email)
        ) || normalizeEmail(user.email)
      : normalizeEmail(user.email);

    const mitt: Party = body.mittente ?? {};
    const dest: Party = body.destinatario ?? {};
    const fatt: Party = body.fatturazione ?? body.fatt ?? {};

    const rawColli: any[] = Array.isArray(body.colli) ? body.colli : [];
    const colli_n: number | null = rawColli.length || null;

    const pesoTot = rawColli.reduce((sum, c) => sum + (toNum(c?.peso ?? c?.peso_kg) || 0), 0);
    const peso_reale_kg = pesoTot > 0 ? Number(pesoTot.toFixed(3)) : toNum(body.peso_reale_kg);

    const giorno_ritiro = toISODate(body.ritiroData ?? body.giorno_ritiro);
    const incoterm = firstNonEmpty(body.incoterm, body.incoterm_norm).toUpperCase() || null;
    const tipo_spedizione = firstNonEmpty(body.tipoSped, body.tipo_spedizione) || null;

    // ✅ QUESTO è il campo che ti serve per l’icona pallet/pacco
    // (preferisci colonna esplicita, non “fields”)
  const formato_sped =
  firstNonEmpty(
    // ✅ colonna esplicita (se già la mandi)
    body.formato_sped,

    // ✅ NOME CORRETTO usato oggi dal frontend
    body.formato,
    body?.fields?.formato,

    // ✅ compat legacy (root)
    body.shipping_method,
    body.shippingMethod,
    body.tipo_pacco,
    body.tipoPacco,

    // ✅ compat legacy (in fields)
    body?.fields?.shipping_method,
    body?.fields?.shippingMethod,
    body?.fields?.tipo_pacco,
    body?.fields?.tipoPacco,

    // ✅ compat “form webflow”
    body?.fields?.shipping_method?.value,
    body?.fields?.tipo_pacco?.value
  ) || null;


    const attachments = body.attachments ?? body.allegati ?? {};
    const ldv = att(attachments.ldv ?? body.ldv);
    const fattura_proforma = att(attachments.fattura_proforma ?? body.fattura_proforma);
    const fattura_commerciale = att(attachments.fattura_commerciale ?? body.fattura_commerciale);
    const dle = att(attachments.dle ?? body.dle);
    const allegato1 = att(attachments.allegato1 ?? body.allegato1);
    const allegato2 = att(attachments.allegato2 ?? body.allegato2);
    const allegato3 = att(attachments.allegato3 ?? body.allegato3);
    const allegato4 = att(attachments.allegato4 ?? body.allegato4);

    const baseRow: any = {
      email_cliente: emailTarget || user.email,
      email_norm: emailTarget,

      mittente_paese: mitt.paese ?? body.mittente_paese ?? null,
      mittente_citta: mitt.citta ?? body.mittente_citta ?? null,
      mittente_cap: mitt.cap ?? body.mittente_cap ?? null,
      mittente_indirizzo: mitt.indirizzo ?? body.mittente_indirizzo ?? null,
      mittente_rs:
        mitt.ragioneSociale ??
        body.mittente_rs ??
        body.mittente_ragione ??
        body.mittente_ragione_sociale ??
        null,
      mittente_telefono: mitt.telefono ?? body.mittente_telefono ?? null,
      mittente_piva: mitt.piva ?? body.mittente_piva ?? null,

      dest_paese: dest.paese ?? body.dest_paese ?? null,
      dest_citta: dest.citta ?? body.dest_citta ?? null,
      dest_cap: dest.cap ?? body.dest_cap ?? null,
      dest_rs:
        dest.ragioneSociale ??
        body.dest_rs ??
        body.dest_ragione ??
        body.dest_ragione_sociale ??
        null,
      dest_telefono: dest.telefono ?? body.dest_telefono ?? null,
      dest_piva: dest.piva ?? body.dest_piva ?? null,

      fatt_rs:
        fatt.ragioneSociale ??
        body.fatt_rs ??
        body.fatt_ragione ??
        body.fatt_ragione_sociale ??
        null,
      fatt_piva: fatt.piva ?? body.fatt_piva ?? null,
      fatt_valuta: body.fatt_valuta ?? body.valuta ?? null,

      tipo_spedizione,
      incoterm,
      incoterm_norm: incoterm,

      giorno_ritiro,
      peso_reale_kg,
      colli_n,

      formato_sped, // ✅ RIPRISTINATO

      carrier: body.carrier ?? null,
      tracking_code: body.tracking_code ?? null,
      status: body.status ?? "Ricevuta",

      fields: body.fields ?? {},

      ldv,
      fattura_proforma,
      fattura_commerciale,
      dle,
      allegato1,
      allegato2,
      allegato3,
      allegato4,
    };

    // ✅ Generazione human_id DEFINITIVA (come prima), con retry anti-duplicati
    const supaAdmin = admin();
    const supaAny = supaAdmin as any;

    let shipment: any = null;
    const MAX_RETRY = 6;
    let attempt = 0;
    let lastErr: any = null;

    while (attempt < MAX_RETRY) {
      attempt++;
      const human_id = await nextHumanIdForToday(supaAdmin);
      const insertRow = { ...baseRow, human_id };

      const { data, error } = await supaAny
        .schema("spst")
        .from("shipments")
        .insert(insertRow)
        .select()
        .single();

      if (!error) {
        shipment = data;
        break;
      }
      // retry se collisione
      if (error.code === "23505" || /unique/i.test(error.message)) {
        lastErr = error;
        continue;
      }
      lastErr = error;
      break;
    }

    if (!shipment) {
      return NextResponse.json(
        { ok: false, error: "INSERT_FAILED", details: lastErr?.message || lastErr },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true, shipment, scope: staff ? "staff" : "client" });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: "UNEXPECTED_ERROR", details: String(e?.message || e) },
      { status: 500 }
    );
  }
}
