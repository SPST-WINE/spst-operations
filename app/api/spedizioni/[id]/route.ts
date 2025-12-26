// app/api/spedizioni/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabaseServerSpst } from "@/lib/supabase/server";
import { requireStaff } from "@/lib/auth/requireStaff";

import type { ShipmentDTO } from "@/lib/contracts/shipment";
import { mapShipmentRowToDTO } from "@/lib/mappers/shipment.mapper";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

// HELPER CRYPTO //

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

function pickKeys(obj: any, keys: string[]) {
  const out: Record<string, any> = {};
  for (const k of keys) out[k] = obj?.[k];
  return out;
}

// evita di loggare allegati/fields enormi
function redactPayload(payload: Record<string, any>) {
  const redacted = { ...payload };
  const bigKeys = [
    "fields",
    "ldv",
    "fattura_proforma",
    "fattura_commerciale",
    "dle",
    "allegato1",
    "allegato2",
    "allegato3",
    "allegato4",
  ];
  for (const k of bigKeys) {
    if (k in redacted) redacted[k] = "[REDACTED]";
  }
  return redacted;
}


/* ───────────── Helpers ───────────── */

function admin() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing SUPABASE_URL/SERVICE_ROLE");
  return createClient(url, key, { auth: { persistSession: false } }) as any;
}

function isUuid(x: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    x
  );
}

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

const SHIPMENT_SELECT = `
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

  colli_n,peso_reale_kg,

  ldv,fattura_proforma,fattura_commerciale,dle,
  allegato1,allegato2,allegato3,allegato4,

  fields
`;

const PACKAGES_SELECT = `
  id,created_at,
  contenuto,
  length_cm,width_cm,height_cm,
  weight_kg,
  weight_volumetric_kg,
  weight_tariff_kg,
  volumetric_divisor,
  volume_cm3
`;

/* ───────────── GET /api/spedizioni/[id] ─────────────
   ✅ Supporta sia UUID che human_id
   ✅ Staff: service role
   ✅ Client: RLS (schema("spst"))
*/
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const request_id = rid();
  const idOrHuman = params.id;

  const debug =
    process.env.DEBUG_API === "1" ||
    req.nextUrl.searchParams.get("debug") === "1";

  console.log(
    `[api/spedizioni/[id]] GET start request_id=${request_id} idOrHuman=${idOrHuman}`
  );

  if (!idOrHuman) {
    console.log(
      `[api/spedizioni/[id]] GET missing id request_id=${request_id}`
    );
    return NextResponse.json(
      { ok: false, error: "MISSING_ID", request_id },
      { status: 400 }
    );
  }

  const supa = supabaseServerSpst();
  const {
    data: { user },
  } = await supa.auth.getUser();

  console.log(
    `[api/spedizioni/[id]] GET auth request_id=${request_id} user_id=${user?.id ?? null} email=${user?.email ?? null}`
  );

  if (!user?.id) {
    return NextResponse.json(
      { ok: false, error: "UNAUTHENTICATED", request_id },
      { status: 401 }
    );
  }

  const staff = await isStaff();
  const isIdUuid = isUuid(idOrHuman);

  console.log(
    `[api/spedizioni/[id]] GET ctx request_id=${request_id} staff=${staff} isUuid=${isIdUuid}`
  );

  try {
    if (staff) {
      const supaAdmin = admin();

      const shipQ = (supaAdmin as any)
        .schema("spst")
        .from("shipments")
        .select(SHIPMENT_SELECT);

      const shipRes = isIdUuid
        ? await shipQ.eq("id", idOrHuman).single()
        : await shipQ.eq("human_id", idOrHuman).single();

      const { data: row, error } = shipRes;

      if (error || !row) {
        console.log(
          `[api/spedizioni/[id]] GET staff NOT_FOUND request_id=${request_id} supabase_error=${safeJson({
            message: error?.message,
            code: (error as any)?.code,
            details: (error as any)?.details,
            hint: (error as any)?.hint,
          })}`
        );
        return NextResponse.json(
          {
            ok: false,
            error: "NOT_FOUND",
            request_id,
            ...(debug ? { supabase_error: error } : {}),
          },
          { status: 404 }
        );
      }

      const shipmentId = row.id;

      const pkgsRes = await (supaAdmin as any)
        .schema("spst")
        .from("packages")
        .select(PACKAGES_SELECT)
        .eq("shipment_id", shipmentId)
        .order("created_at", { ascending: true });

      console.log(
        `[api/spedizioni/[id]] GET staff ok request_id=${request_id} shipment_id=${shipmentId} packages=${pkgsRes.data?.length ?? 0} packages_error=${pkgsRes.error?.message ?? null}`
      );

      const dto: ShipmentDTO = mapShipmentRowToDTO(row, pkgsRes.data ?? []);

      const res = NextResponse.json(
        { ok: true, shipment: dto, scope: "staff", request_id },
        { status: 200 }
      );
      res.headers.set("x-request-id", request_id);
      return res;
    }

    // CLIENT (RLS)
    const shipQ = (supa as any).schema("spst").from("shipments").select(SHIPMENT_SELECT);

    const shipRes = isIdUuid
      ? await shipQ.eq("id", idOrHuman).single()
      : await shipQ.eq("human_id", idOrHuman).single();

    const { data: row, error } = shipRes;

    if (error || !row) {
      console.log(
        `[api/spedizioni/[id]] GET client NOT_FOUND request_id=${request_id} supabase_error=${safeJson({
          message: error?.message,
          code: (error as any)?.code,
          details: (error as any)?.details,
          hint: (error as any)?.hint,
        })}`
      );
      return NextResponse.json(
        {
          ok: false,
          error: "NOT_FOUND",
          request_id,
          ...(debug ? { supabase_error: error } : {}),
        },
        { status: 404 }
      );
    }

    const shipmentId = row.id;

    const pkgsRes = await (supa as any)
      .schema("spst")
      .from("packages")
      .select(PACKAGES_SELECT)
      .eq("shipment_id", shipmentId)
      .order("created_at", { ascending: true });

    console.log(
      `[api/spedizioni/[id]] GET client ok request_id=${request_id} shipment_id=${shipmentId} packages=${pkgsRes.data?.length ?? 0} packages_error=${pkgsRes.error?.message ?? null}`
    );

    const dto: ShipmentDTO = mapShipmentRowToDTO(row, pkgsRes.data ?? []);

    const res = NextResponse.json(
      { ok: true, shipment: dto, scope: "client", request_id },
      { status: 200 }
    );
    res.headers.set("x-request-id", request_id);
    return res;
  } catch (e: any) {
    console.log(
      `[api/spedizioni/[id]] GET server_error request_id=${request_id} err=${String(
        e?.message || e
      )}`
    );
    return NextResponse.json(
      { ok: false, error: "SERVER_ERROR", request_id, details: String(e?.message || e) },
      { status: 500 }
    );
  }
}


/* ───────────── PATCH /api/spedizioni/[id] ─────────────
   Staff-only. Payload whitelisted.
*/
const PATCH_ALLOWED_KEYS = new Set<string>([
  "status",
  "carrier",
  "service_code",
  "tracking_code",
  "pickup_at",
  "giorno_ritiro",
  "note_ritiro",

  "dest_abilitato_import",

  "declared_value",

  "ldv",
  "fattura_proforma",
  "fattura_commerciale",
  "dle",
  "allegato1",
  "allegato2",
  "allegato3",
  "allegato4",

  "fields",
]);

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const request_id = rid();

  const staff = await requireStaff();
  if ("response" in staff) return staff.response;

  const id = params.id;
  if (!id) {
    const res = NextResponse.json(
      { ok: false, error: "MISSING_ID", request_id },
      { status: 400 }
    );
    res.headers.set("x-request-id", request_id);
    return res;
  }

  console.log(`[api/spedizioni/[id]] PATCH start request_id=${request_id} id=${id}`);

  const payload = (await req.json().catch(() => ({} as any))) as Record<string, any>;


  console.log(
    `[api/spedizioni/[id]] PATCH payload request_id=${request_id} keys=${Object.keys(payload || {}).join(",")} body=${safeJson(
      redactPayload(payload),
      4000
    )}`
  );

  const update: Record<string, any> = {};
  for (const [k, v] of Object.entries(payload)) {
    if (PATCH_ALLOWED_KEYS.has(k)) update[k] = v;
  }

    console.log(
    `[api/spedizioni/[id]] PATCH update request_id=${request_id} updateKeys=${Object.keys(update).join(",")} update=${safeJson(
      redactPayload(update),
      3000
    )}`
  );


    if (Object.keys(update).length === 0) {
    const res = NextResponse.json(
      { ok: false, error: "NO_ALLOWED_FIELDS", request_id },
      { status: 400 }
    );
    res.headers.set("x-request-id", request_id);
    return res;
  }


    try {
    const supaAdmin = admin();

    const { data: row, error } = await (supaAdmin as any)
      .schema("spst")
      .from("shipments")
      .update(update)
      .eq("id", id)
      .select(SHIPMENT_SELECT)
      .single();

    if (error || !row) {
      console.log(
        `[api/spedizioni/[id]] PATCH update_failed request_id=${request_id} id=${id} supabase_error=${safeJson({
          message: error?.message,
          code: (error as any)?.code,
          details: (error as any)?.details,
          hint: (error as any)?.hint,
        })}`
      );

      const res = NextResponse.json(
        { ok: false, error: "UPDATE_FAILED", request_id, details: error?.message ?? null },
        { status: 500 }
      );
      res.headers.set("x-request-id", request_id);
      return res;
    }

    const { data: pkgs, error: pkgsError } = await (supaAdmin as any)
      .schema("spst")
      .from("packages")
      .select(PACKAGES_SELECT)
      .eq("shipment_id", id)
      .order("created_at", { ascending: true });

    if (pkgsError) {
      console.log(
        `[api/spedizioni/[id]] PATCH packages_select_error request_id=${request_id} id=${id} err=${pkgsError.message}`
      );
    } else {
      console.log(
        `[api/spedizioni/[id]] PATCH ok request_id=${request_id} id=${id} packages=${pkgs?.length ?? 0}`
      );
    }

    const dto: ShipmentDTO = mapShipmentRowToDTO(row, pkgs ?? []);
    const res = NextResponse.json({ ok: true, shipment: dto, request_id });
    res.headers.set("x-request-id", request_id);
    return res;
  
      } catch (e: any) {
    console.log(
      `[api/spedizioni/[id]] PATCH server_error request_id=${request_id} id=${id} err=${String(
        e?.message || e
      )}`
    );
    const res = NextResponse.json(
      { ok: false, error: "SERVER_ERROR", request_id, details: String(e?.message || e) },
      { status: 500 }
    );
    res.headers.set("x-request-id", request_id);
    return res;
  }
} 
