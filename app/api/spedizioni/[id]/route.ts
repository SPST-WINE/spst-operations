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
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const idOrHuman = params.id;
  if (!idOrHuman) {
    return NextResponse.json({ ok: false, error: "MISSING_ID" }, { status: 400 });
  }

  const supa = supabaseServerSpst();
  const {
    data: { user },
  } = await supa.auth.getUser();

  if (!user?.id) {
    return NextResponse.json({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });
  }

  const staff = await isStaff();

  try {
    const isIdUuid = isUuid(idOrHuman);

    // ───── STAFF ─────
    if (staff) {
      const supaAdmin = admin();

      const shipQ = (supaAdmin as any)
        .schema("spst")
        .from("shipments")
        .select(SHIPMENT_SELECT);

      const { data: row, error } = isIdUuid
        ? await shipQ.eq("id", idOrHuman).single()
        : await shipQ.eq("human_id", idOrHuman).single();

      if (error || !row) {
        return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404 });
      }

      const shipmentId = row.id;

      const { data: pkgs } = await (supaAdmin as any)
        .schema("spst")
        .from("packages")
        .select(PACKAGES_SELECT)
        .eq("shipment_id", shipmentId)
        .order("created_at", { ascending: true });

      const dto: ShipmentDTO = mapShipmentRowToDTO(row, pkgs ?? []);
      return NextResponse.json({ ok: true, shipment: dto, scope: "staff" });
    }

    // ───── CLIENT (RLS) ─────
    const shipQ = (supa as any)
      .schema("spst")
      .from("shipments")
      .select(SHIPMENT_SELECT);

    const { data: row, error } = isIdUuid
      ? await shipQ.eq("id", idOrHuman).single()
      : await shipQ.eq("human_id", idOrHuman).single();

    if (error || !row) {
      return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404 });
    }

    const shipmentId = row.id;

    const { data: pkgs } = await (supa as any)
      .schema("spst")
      .from("packages")
      .select(PACKAGES_SELECT)
      .eq("shipment_id", shipmentId)
      .order("created_at", { ascending: true });

    const dto: ShipmentDTO = mapShipmentRowToDTO(row, pkgs ?? []);
    return NextResponse.json({ ok: true, shipment: dto, scope: "client" });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: "SERVER_ERROR", details: String(e?.message || e) },
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
  const staff = await requireStaff();
  if ("response" in staff) return staff.response;

  const id = params.id;
  if (!id) {
    return NextResponse.json({ ok: false, error: "MISSING_ID" }, { status: 400 });
  }

  const payload = (await req.json().catch(() => ({} as any))) as Record<string, any>;

  const update: Record<string, any> = {};
  for (const [k, v] of Object.entries(payload)) {
    if (PATCH_ALLOWED_KEYS.has(k)) update[k] = v;
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ ok: false, error: "NO_ALLOWED_FIELDS" }, { status: 400 });
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
      return NextResponse.json(
        { ok: false, error: "UPDATE_FAILED", details: error?.message ?? null },
        { status: 500 }
      );
    }

    const { data: pkgs } = await (supaAdmin as any)
      .schema("spst")
      .from("packages")
      .select(PACKAGES_SELECT)
      .eq("shipment_id", id)
      .order("created_at", { ascending: true });

    const dto: ShipmentDTO = mapShipmentRowToDTO(row, pkgs ?? []);
    return NextResponse.json({ ok: true, shipment: dto });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: "SERVER_ERROR", details: String(e?.message || e) },
      { status: 500 }
    );
  }
}
