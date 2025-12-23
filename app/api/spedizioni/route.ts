// app/api/spedizioni/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

import { ShipmentInputZ, type ShipmentDTO } from "@/lib/contracts/shipment";
import { supabaseServerSpst } from "@/lib/supabase/server";

/* ───────────── Helpers ───────────── */

function normalizeEmail(x?: string | null) {
  const v = (x ?? "").trim();
  return v ? v.toLowerCase() : null;
}

const EMPTY_ATTACHMENTS = {
  ldv: null,
  fattura_proforma: null,
  fattura_commerciale: null,
  dle: null,
  allegato1: null,
  allegato2: null,
  allegato3: null,
  allegato4: null,
} as const;

function mapListRowToDTO(row: any): ShipmentDTO {
  return {
    id: row.id,
    human_id: row.human_id ?? null,
    created_at: row.created_at,

    customer_id: row.customer_id ?? null,
    email_cliente: row.email_cliente ?? null,

    status: row.status ?? null,
    carrier: row.carrier ?? null,
    service_code: row.service_code ?? null,
    tracking_code: row.tracking_code ?? null,

    tipo_spedizione: row.tipo_spedizione ?? null,
    incoterm: row.incoterm ?? null,
    declared_value: row.declared_value ?? null,
    fatt_valuta: row.fatt_valuta ?? null,

    giorno_ritiro: row.giorno_ritiro ?? null,
    pickup_at: row.pickup_at ?? null,
    note_ritiro: row.note_ritiro ?? null,

    formato_sped: row.formato_sped ?? null,
    contenuto_generale: row.contenuto_generale ?? null,

    mittente: {
      rs: row.mittente_rs ?? null,
      referente: row.mittente_referente ?? null,
      telefono: row.mittente_telefono ?? null,
      piva: row.mittente_piva ?? null,
      paese: row.mittente_paese ?? null,
      citta: row.mittente_citta ?? null,
      cap: row.mittente_cap ?? null,
      indirizzo: row.mittente_indirizzo ?? null,
    },

    destinatario:
      row.dest_rs || row.dest_paese || row.dest_indirizzo
        ? {
            rs: row.dest_rs ?? null,
            referente: row.dest_referente ?? null,
            telefono: row.dest_telefono ?? null,
            piva: row.dest_piva ?? null,
            paese: row.dest_paese ?? null,
            citta: row.dest_citta ?? null,
            cap: row.dest_cap ?? null,
            indirizzo: row.dest_indirizzo ?? null,
            abilitato_import: row.dest_abilitato_import ?? null,
          }
        : null,

    fatturazione:
      row.fatt_rs || row.fatt_paese || row.fatt_indirizzo
        ? {
            rs: row.fatt_rs ?? null,
            referente: row.fatt_referente ?? null,
            telefono: row.fatt_telefono ?? null,
            piva: row.fatt_piva ?? null,
            paese: row.fatt_paese ?? null,
            citta: row.fatt_citta ?? null,
            cap: row.fatt_cap ?? null,
            indirizzo: row.fatt_indirizzo ?? null,
          }
        : null,

    colli_n: row.colli_n ?? null,
    peso_reale_kg: row.peso_reale_kg ?? null,

    // ✅ sempre array (anche in lista)
    packages: [],

    // ✅ shape standard (anche in lista)
    attachments: { ...EMPTY_ATTACHMENTS },

    extras: null,
  };
}

const LIST_SELECT = `
  id,created_at,human_id,
  customer_id,email_cliente,email_norm,

  status,carrier,service_code,tracking_code,

  tipo_spedizione,incoterm,declared_value,fatt_valuta,

  giorno_ritiro,pickup_at,note_ritiro,

  formato_sped,contenuto_generale,

  mittente_rs,mittente_referente,mittente_telefono,mittente_piva,
  mittente_paese,mittente_citta,mittente_cap,mittente_indirizzo,

  dest_rs,dest_referente,dest_telefono,dest_piva,
  dest_paese,dest_citta,dest_cap,dest_indirizzo,
  dest_abilitato_import,

  fatt_rs,fatt_referente,fatt_telefono,fatt_piva,
  fatt_paese,fatt_citta,fatt_cap,fatt_indirizzo,

  colli_n,peso_reale_kg
`;

/** service-role client (no session persistence) */
function admin() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE ||
    process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) throw new Error("Missing SUPABASE_URL/SERVICE_ROLE");
  return createClient(url, key, { auth: { persistSession: false } }) as any;
}

/** staff check (cookie-based) */
async function isStaff(): Promise<boolean> {
  const supa = supabaseServerSpst();
  const { data } = await supa.auth.getUser();
  const user = data?.user;
  if (!user?.id || !user?.email) return false;

  const email = user.email.toLowerCase().trim();
  if (email === "info@spst.it") return true;

  const { data: staff } = await (supa as any)
    .schema("spst")
    .from("staff_users")
    .select("role, enabled")
    .eq("user_id", user.id)
    .maybeSingle();

  const enabled =
    typeof (staff as any)?.enabled === "boolean" ? (staff as any).enabled : true;

  const role = String((staff as any)?.role || "").toLowerCase().trim();
  return enabled && (role === "admin" || role === "staff" || role === "operator");
}

/* ───────────── GET /api/spedizioni ─────────────
   - CLIENT: via RLS
   - STAFF: service role (vede tutto)
   - SEARCH: filtra su search_text (trigram index)
   - OUTPUT: rows = ShipmentDTO “DTO-safe” (subset: packages=[], attachments empty, extras null)
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
    const emailParam = normalizeEmail(url.searchParams.get("email"));
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    const supa = supabaseServerSpst();
    const {
      data: { user },
    } = await supa.auth.getUser();

    if (!user?.id) {
      return NextResponse.json(
        { ok: false, error: "UNAUTHENTICATED" },
        { status: 401 }
      );
    }

    const staff = await isStaff();

    // STAFF MODE
    if (staff) {
      const supaAdmin = admin();
      let query = supaAdmin
        .schema("spst")
        .from("shipments")
        .select(LIST_SELECT, { count: "exact" });

      if (emailParam) query = query.eq("email_norm", emailParam);

      // ✅ search_text (indice trigram)
      if (q) {
        const safe = q.replace(/[%_]/g, "");
        const pattern = `%${safe.toLowerCase()}%`;
        query = query.ilike("search_text", pattern);
      }

      query =
        sort === "created_asc"
          ? query.order("created_at", { ascending: true })
          : query.order("created_at", { ascending: false });

      const { data, error, count } = await query.range(from, to);
      if (error)
        return NextResponse.json(
          { ok: false, error: error.message },
          { status: 500 }
        );

      return NextResponse.json({
        ok: true,
        page,
        limit,
        total: count ?? null,
        rows: (data ?? []).map(mapListRowToDTO),
        scope: "staff",
      });
    }

    // CLIENT MODE (RLS)
    let query = supa
      .from("shipments")
      .select(LIST_SELECT, { count: "exact" });

    // ✅ search_text (indice trigram)
    if (q) {
      const safe = q.replace(/[%_]/g, "");
      const pattern = `%${safe.toLowerCase()}%`;
      query = query.ilike("search_text", pattern);
    }

    query =
      sort === "created_asc"
        ? query.order("created_at", { ascending: true })
        : query.order("created_at", { ascending: false });

    const { data, error, count } = await query.range(from, to);
    if (error)
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: 500 }
      );

    return NextResponse.json({
      ok: true,
      page,
      limit,
      total: count ?? null,
      rows: (data ?? []).map(mapListRowToDTO),
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
   Contratti = unica fonte di verità (ShipmentInputZ)
   - CLIENT: forza email_cliente = email sessione
   - STAFF: può creare per altri (email_cliente dal body; fallback su email sessione)
   - COLLI: scrive su spst.packages (trigger DB aggiorna colli_n/peso_reale_kg)
*/
export async function POST(req: NextRequest) {
  try {
    // cookie-based auth (per forzare email + staff)
    const supaSession = supabaseServerSpst();
    const {
      data: { user },
    } = await supaSession.auth.getUser();

    if (!user?.id || !user?.email) {
      return NextResponse.json(
        { ok: false, error: "UNAUTHENTICATED" },
        { status: 401 }
      );
    }

    const staff = await isStaff();

    // ✅ parse + validate con contratto (enum rigidi ecc.)
    let input: any;
    try {
      input = ShipmentInputZ.parse(await req.json());
    } catch (err: any) {
      return NextResponse.json(
        { ok: false, error: "VALIDATION_ERROR", details: err?.errors ?? err },
        { status: 400 }
      );
    }

    // service-role client per insert
    const supaAdmin = admin();

    // ✅ robust email handling (evita .toLowerCase su null)
    // CLIENT: non può creare per altri
    if (!staff) {
      input.email_cliente =
        normalizeEmail(user.email) || user.email.toLowerCase().trim();
    } else {
      const email = normalizeEmail(input.email_cliente) || normalizeEmail(user.email);
      input.email_cliente = email || user.email.toLowerCase().trim();
    }

    // ✅ crea shipment (email_norm sempre popolata)
    const { data: shipment, error } = await (supaAdmin as any)
      .schema("spst")
      .from("shipments")
      .insert({
        email_cliente: input.email_cliente,
        email_norm: normalizeEmail(input.email_cliente), // ✅ FIX #1

        tipo_spedizione: input.tipo_spedizione,
        incoterm: input.incoterm,

        declared_value: input.declared_value,
        fatt_valuta: input.fatt_valuta,

        giorno_ritiro: input.giorno_ritiro,
        pickup_at: input.pickup_at,
        note_ritiro: input.note_ritiro,

        formato_sped: input.formato_sped,
        contenuto_generale: input.contenuto_generale,

        mittente_rs: input.mittente.rs,
        mittente_referente: input.mittente.referente,
        mittente_telefono: input.mittente.telefono,
        mittente_piva: input.mittente.piva,
        mittente_paese: input.mittente.paese,
        mittente_citta: input.mittente.citta,
        mittente_cap: input.mittente.cap,
        mittente_indirizzo: input.mittente.indirizzo,

        dest_rs: input.destinatario?.rs ?? null,
        dest_referente: input.destinatario?.referente ?? null,
        dest_telefono: input.destinatario?.telefono ?? null,
        dest_piva: input.destinatario?.piva ?? null,
        dest_paese: input.destinatario?.paese ?? null,
        dest_citta: input.destinatario?.citta ?? null,
        dest_cap: input.destinatario?.cap ?? null,
        dest_indirizzo: input.destinatario?.indirizzo ?? null,
        dest_abilitato_import: (input.destinatario as any)?.abilitato_import ?? null,

        fatt_rs: input.fatturazione?.rs ?? null,
        fatt_referente: input.fatturazione?.referente ?? null,
        fatt_telefono: input.fatturazione?.telefono ?? null,
        fatt_piva: input.fatturazione?.piva ?? null,
        fatt_paese: input.fatturazione?.paese ?? null,
        fatt_citta: input.fatturazione?.citta ?? null,
        fatt_cap: input.fatturazione?.cap ?? null,
        fatt_indirizzo: input.fatturazione?.indirizzo ?? null,

        // extras legacy (alias fields) — ok tenerli, ma NON come fonte primaria
        fields: input.extras ?? null,
      })
      .select("id")
      .single();

    if (error || !shipment?.id) {
      return NextResponse.json(
        { ok: false, error: "INSERT_FAILED", details: error?.message ?? null },
        { status: 500 }
      );
    }

    const shipmentId = shipment.id as string;

    // ✅ scrivi colli su packages (source of truth)
// DB columns: weight_kg + length_cm/width_cm/height_cm + contenuto
const colli = Array.isArray(input.colli) ? input.colli : [];
if (colli.length > 0) {
  const payload = colli.map((c: any) => ({
    shipment_id: shipmentId,
    contenuto: c.contenuto ?? null,
    weight_kg: c.peso_reale_kg ?? null,
    length_cm: c.lato1_cm ?? null,
    width_cm: c.lato2_cm ?? null,
    height_cm: c.lato3_cm ?? null,
  }));

  const { error: pkgErr } = await (supaAdmin as any)
    .schema("spst")
    .from("packages")
    .insert(payload);

  if (pkgErr) {
    return NextResponse.json(
      {
        ok: false,
        error: "PACKAGES_INSERT_FAILED",
        shipment_id: shipmentId,
        details: pkgErr.message,
      },
      { status: 500 }
    );
  }
}


    return NextResponse.json(
      { ok: true, shipment_id: shipmentId },
      { status: 201 }
    );
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: "UNEXPECTED_ERROR", details: String(e?.message || e) },
      { status: 500 }
    );
  }
}
