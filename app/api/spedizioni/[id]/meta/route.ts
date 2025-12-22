// app/api/spedizioni/[id]/meta/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabaseServerSpst } from "@/lib/supabase/server";
import { requireStaff } from "@/lib/auth/requireStaff";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

function admin() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing SUPABASE_URL/SERVICE_ROLE");
  return createClient(url, key, { auth: { persistSession: false } }) as any;
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

const SELECT_META = `
  id, created_at, human_id,
  email_cliente, email_norm,
  status,
  carrier, service_code, tracking_code,
  giorno_ritiro, pickup_at,
  note_ritiro,
  colli_n, peso_reale_kg,
  formato_sped,
  declared_value,
  incoterm,
  tipo_spedizione
`;

// ✅ PATCH whitelist (NO payload libero)
const PATCH_ALLOWED = new Set<string>([
  "status",
  "carrier",
  "service_code",
  "tracking_code",
  "giorno_ritiro",
  "pickup_at",
  "note_ritiro",
  "declared_value",
]);

function pickAllowed(payload: Record<string, any>) {
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(payload)) {
    if (PATCH_ALLOWED.has(k)) out[k] = v;
  }
  return out;
}

/* ───────────── GET /meta ───────────── */
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const id = params.id;
  if (!id) {
    return NextResponse.json({ ok: false, error: "MISSING_ID" }, { status: 400 });
  }

  const supa = supabaseServerSpst();
  const { data: { user } } = await supa.auth.getUser();
  if (!user?.id) {
    return NextResponse.json({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });
  }

  const staff = await isStaff();

  try {
    if (staff) {
      const supaAdmin = admin();
      const { data, error } = await (supaAdmin as any)
        .schema("spst")
        .from("shipments")
        .select(SELECT_META)
        .eq("id", id)
        .single();

      if (error || !data) {
        return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404 });
      }

      return NextResponse.json({ ok: true, meta: data, scope: "staff" });
    }

    // client mode (RLS)
    const { data, error } = await supa
      .from("shipments")
      .select(SELECT_META)
      .eq("id", id)
      .single();

    if (error || !data) {
      return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404 });
    }

    return NextResponse.json({ ok: true, meta: data, scope: "client" });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: "SERVER_ERROR", details: String(e?.message || e) },
      { status: 500 }
    );
  }
}

/* ───────────── PATCH /meta (staff-only) ───────────── */
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
  const update = pickAllowed(payload);

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ ok: false, error: "NO_ALLOWED_FIELDS" }, { status: 400 });
  }

  try {
    const supaAdmin = admin();
    const { data, error } = await (supaAdmin as any)
      .schema("spst")
      .from("shipments")
      .update(update)
      .eq("id", id)
      .select(SELECT_META)
      .single();

    if (error || !data) {
      return NextResponse.json(
        { ok: false, error: "UPDATE_FAILED", details: error?.message ?? null },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true, meta: data });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: "SERVER_ERROR", details: String(e?.message || e) },
      { status: 500 }
    );
  }
}
