// app/api/spedizioni/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabaseServerSpst } from "@/lib/supabase/server";

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
  l1?: number | null;
  l2?: number | null;
  l3?: number | null;
  peso?: number | null;
  contenuto?: string | null;
  [k: string]: any;
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

  // supporta dd-mm-yyyy / dd/mm/yyyy / yyyy-mm-dd
  const m1 = s.match(/^(\d{2})[/-](\d{2})[/-](\d{4})$/);
  if (m1) {
    const dd = m1[1];
    const mm = m1[2];
    const yyyy = m1[3];
    return `${yyyy}-${mm}-${dd}`;
  }
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

/** Verifica staff usando stesso supabase cookie-based (NON fidarti di header). */
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

function corsJson(payload: any, status = 200) {
  return NextResponse.json(payload, {
    status,
    headers: { "Access-Control-Allow-Origin": "*" },
  });
}

/* ───────────── GET: lista spedizioni ─────────────
   - CLIENT: vede solo le sue (RLS)
   - STAFF: può vedere tutte, e può filtrare per email
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

    // deve essere loggato (sia client che staff)
    const supa = supabaseServerSpst();
    const {
      data: { user },
    } = await supa.auth.getUser();

    if (!user?.id || !user?.email) {
      return corsJson({ ok: false, error: "UNAUTHENTICATED" }, 401);
    }

    const staff = await isStaff();

    // STAFF MODE: service role (vedi tutto) + filtri
    if (staff) {
      const supaAdmin = admin();

      let query = supaAdmin
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
          fatt_rs,fatt_piva,fatt_valuta
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
            `mittente_rs.ilike.${pattern}`,
            `dest_rs.ilike.${pattern}`,
            `tracking_code.ilike.${pattern}`,
          ].join(",")
        );
      }

      if (sort === "created_asc") query = query.order("created_at", { ascending: true });
      else query = query.order("created_at", { ascending: false });

      const { data, error, count } = await query.range(from, to);

      if (error) {
        return corsJson({ ok: false, error: error.message }, 500);
      }

      return corsJson({
        ok: true,
        page,
        limit,
        total: count ?? null,
        rows: data ?? [],
        scope: "staff",
      });
    }

    // CLIENT MODE: RLS (vedi solo le tue). Ignora emailParam.
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
        fatt_rs,fatt_piva,fatt_valuta
      `,
        { count: "exact" }
      );

    if (q) {
      const safe = q.replace(/[%_]/g, "");
      const pattern = `%${safe}%`;
      query = query.or(
        [
          `human_id.ilike.${pattern}`,
          `tracking_code.ilike.${pattern}`,
          `mittente_rs.ilike.${pattern}`,
          `dest_rs.ilike.${pattern}`,
        ].join(",")
      );
    }

    if (sort === "created_asc") query = query.order("created_at", { ascending: true });
    else query = query.order("created_at", { ascending: false });

    const { data, error, count } = await query.range(from, to);

    if (error) {
      return corsJson({ ok: false, error: error.message }, 500);
    }

    return corsJson({
      ok: true,
      page,
      limit,
      total: count ?? null,
      rows: data ?? [],
      scope: "client",
    });
  } catch (e: any) {
    return corsJson(
      { ok: false, error: "UNEXPECTED_ERROR", details: String(e?.message || e) },
      500
    );
  }
}

/* ───────────── POST: crea spedizione ─────────────
   - CLIENT: crea solo per sé (email dal token/session; NO header)
   - STAFF: può creare per altri (email dal body), usa service role
*/
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({} as any));

    const supa = supabaseServerSpst();
    const {
      data: { user },
    } = await supa.auth.getUser();

    if (!user?.id || !user?.email) {
      return corsJson({ ok: false, error: "UNAUTHENTICATED" }, 401);
    }

    const staff = await isStaff();

    // email “target”
    const emailTarget = staff
      ? normalizeEmail(
          firstNonEmpty(
            body.email_cliente,
            body.email,
            body?.mittente?.email,
            body?.destinatario?.email,
            body?.fatturazione?.email,
            body?.fields?.fatturazione?.email
          )
        ) || normalizeEmail(user.email)
      : normalizeEmail(user.email);

    // customer_id (utile per ownership/RLS future). Se rpc non esiste, resta null.
    let customer_id: string | null = null;
    try {
      const { data: cid } = await supa.rpc("current_customer_id");
      if (typeof cid === "string" && cid) customer_id = cid;
    } catch {
      // ignore
    }

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
    const incoterm = firstNonEmpty(body.incoterm, body.incoterm_norm).toUpperCase() || null;
    const tipo_spedizione = firstNonEmpty(body.tipoSped, body.tipo_spedizione) || null;

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
    const mittente_indirizzo = mitt.indirizzo ?? body.mittente_indirizzo ?? null;

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
    const fatt_valuta = (fatt as any).valuta ?? body.fatt_valuta ?? body.valuta ?? null;

    // ── Attachments legacy json in tabella ───────────────────────
    const attachments = body.attachments ?? body.allegati ?? {};
    const ldv = att(attachments.ldv ?? body.ldv);
    const fattura_proforma = att(attachments.fattura_proforma ?? body.fattura_proforma);
    const fattura_commerciale = att(
      attachments.fattura_commerciale ?? body.fattura_commerciale
    );
    const dle = att(attachments.dle ?? body.dle);
    const allegato1 = att(attachments.allegato1 ?? body.allegato1);
    const allegato2 = att(attachments.allegato2 ?? body.allegato2);
    const allegato3 = att(attachments.allegato3 ?? body.allegato3);
    const allegato4 = att(attachments.allegato4 ?? body.allegato4);

    // ── Assicurazione ────────────────────────────────────────────
    const insuranceRequested = Boolean(
      body.assicurazioneAttiva ??
        body.assicurazione_pallet ??
        body.insurance_requested ??
        body?.fields?.insurance_requested
    );
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
        "email_cliente",
        "email",
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

    (fieldsSafe as any).insurance_requested = insuranceRequested;
    (fieldsSafe as any).insurance_value_eur = insuranceValueEur;

    // ── Row principale ────────────────────────────────────────────
    const baseRow: any = {
      customer_id, // può essere null se rpc non disponibile
      email_cliente: emailTarget || user.email,
      email_norm: emailTarget,
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
      declared_value: toNum(body.declared_value) ?? null,
      status: body.status ?? "Ricevuta",
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

    // genera human_id in modo consistente (anche per client) usando service role
    const supaAdmin = admin();
    const supaAny = supaAdmin as any;

    async function nextHumanIdForToday(srv: any) {
      // usa la tua stessa logica già in DB/app: qui la teniamo identica
      const { data, error } = await srv.rpc("next_shipment_human_id");
      if (!error && typeof data === "string" && data) return data;

      // fallback brutale (non dovrebbe servire)
      const d = new Date();
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, "0");
      const dd = String(d.getDate()).padStart(2, "0");
      const base = `${y}${m}${dd}`;
      const rand = String(Math.floor(Math.random() * 900) + 100);
      return `${base}-${rand}`;
    }

    // IMPORTANT: client può creare SOLO per sé → qui non c'è più spoof via header/body
    // staff può creare per altri → già gestito da emailTarget
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
      if (error.code === "23505" || /unique/i.test(error.message)) {
        lastErr = error;
        continue;
      }
      lastErr = error;
      break;
    }

    if (!shipment) {
      return corsJson(
        { ok: false, error: "INSERT_FAILED", details: lastErr?.message || lastErr },
        500
      );
    }

    return corsJson({ ok: true, shipment, scope: staff ? "staff" : "client" }, 200);
  } catch (e: any) {
    return corsJson(
      { ok: false, error: "UNEXPECTED_ERROR", details: String(e?.message || e) },
      500
    );
  }
}
