// app/api/spedizioni/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

import { ShipmentInputZ } from "@/lib/contracts/shipment";
import { supabaseServerSpst } from "@/lib/supabase/server";

/* ───────────── Helpers ───────────── */

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

function normalizeEmail(x?: string | null) {
  const v = (x ?? "").trim();
  return v ? v.toLowerCase() : null;
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
   Contratti = unica fonte di verità (ShipmentInputZ)
   - CLIENT: forza email_cliente = email sessione
   - STAFF: può creare per altri (email_cliente dal body)
*/
export async function POST(req: NextRequest) {
  // cookie-based auth (per capire se staff + per forzare email)
  const supaSession = supabaseServerSpst();
  const {
    data: { user },
  } = await supaSession.auth.getUser();

  if (!user?.id || !user?.email) {
    return NextResponse.json({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });
  }

  const staff = await isStaff();

  // service-role client per insert (DB write)
  const supabase = admin();

  let input: any;
  try {
    input = ShipmentInputZ.parse(await req.json());
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: "VALIDATION_ERROR", details: err?.errors ?? err },
      { status: 400 }
    );
  }

  // CLIENT: non può creare per altri
  if (!staff) {
    input.email_cliente = user.email.toLowerCase().trim();
  } else {
    // staff: se non passa email_cliente, fallback sulla sua (evita null)
    input.email_cliente = (input.email_cliente ?? user.email).toLowerCase().trim();
  }

  const { data: shipment, error } = await supabase
    .from("spst.shipments")
    .insert({
      email_cliente: input.email_cliente,
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

      dest_rs: input.destinatario?.rs,
      dest_referente: input.destinatario?.referente,
      dest_telefono: input.destinatario?.telefono,
      dest_piva: input.destinatario?.piva,
      dest_paese: input.destinatario?.paese,
      dest_citta: input.destinatario?.citta,
      dest_cap: input.destinatario?.cap,
      dest_indirizzo: input.destinatario?.indirizzo,
      dest_abilitato_import: input.destinatario?.abilitato_import,

      fatt_rs: input.fatturazione?.rs,
      fatt_referente: input.fatturazione?.referente,
      fatt_telefono: input.fatturazione?.telefono,
      fatt_piva: input.fatturazione?.piva,
      fatt_paese: input.fatturazione?.paese,
      fatt_citta: input.fatturazione?.citta,
      fatt_cap: input.fatturazione?.cap,
      fatt_indirizzo: input.fatturazione?.indirizzo,

      fields: input.extras ?? {},
    })
    .select("id")
    .single();

  if (error || !shipment?.id) {
    return NextResponse.json(
      { ok: false, error: "INSERT_FAILED", details: error ?? null },
      { status: 500 }
    );
  }

  // insert colli
  const packages = (input.colli ?? []).map((c: any) => ({
    shipment_id: shipment.id,
    contenuto: c.contenuto,
    peso_reale_kg: c.peso_reale_kg,
    lato1_cm: c.lato1_cm,
    lato2_cm: c.lato2_cm,
    lato3_cm: c.lato3_cm,
  }));

  if (packages.length > 0) {
    const { error: pErr } = await supabase.from("spst.packages").insert(packages);
    if (pErr) {
      // scelta “safe”: segnalo errore (eviti spedizioni senza colli)
      // se preferisci: puoi anche fare rollback con RPC/transaction lato DB
      return NextResponse.json(
        { ok: false, error: "PACKAGES_INSERT_FAILED", details: pErr },
        { status: 500 }
      );
    }
  }

  return NextResponse.json({ ok: true, id: shipment.id });
}
