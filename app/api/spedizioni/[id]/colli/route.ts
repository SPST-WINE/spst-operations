// app/api/spedizioni/[id]/colli/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabaseServerSpst } from "@/lib/supabase/server";
import { z } from "zod";

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

async function isStaff(): Promise<boolean> {
  const supa = supabaseServerSpst();
  const { data } = await supa.auth.getUser();
  const user = data?.user;
  if (!user?.id || !user?.email) return false;

  const email = user.email.toLowerCase().trim();
  if (email === "info@spst.it") return true;

  // ✅ schema spst
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

function normalizeEmail(x?: string | null) {
  const v = (x ?? "").trim();
  return v ? v.toLowerCase() : null;
}

/* ───────────── Contract: colli ─────────────
   Replacement totale: { colli: PackageInput[] }
*/
const PackageZ = z.object({
  contenuto: z.string().trim().min(1).nullable().optional(),
  peso_reale_kg: z.number().positive(),
  lato1_cm: z.number().positive(),
  lato2_cm: z.number().positive(),
  lato3_cm: z.number().positive(),
});

const ColliReplaceZ = z.object({
  colli: z.array(PackageZ).min(1),
});

const PACKAGES_SELECT = `
  id,created_at,
  contenuto,
  peso_reale_kg,
  lato1_cm,lato2_cm,lato3_cm
`;

/* ───────────── GET: ritorna colli + totali ───────────── */
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const id = params.id;
  if (!id) return NextResponse.json({ ok: false, error: "MISSING_ID" }, { status: 400 });

  const supa = supabaseServerSpst();
  const { data: { user } } = await supa.auth.getUser();

  if (!user?.id) {
    return NextResponse.json({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });
  }

  const staff = await isStaff();

  try {
    if (staff) {
      const supaAdmin = admin();

      const { data: ship, error: shipErr } = await (supaAdmin as any)
        .schema("spst")
        .from("shipments")
        .select("id, colli_n, peso_reale_kg")
        .eq("id", id)
        .single();

      if (shipErr || !ship) return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404 });

      const { data: pkgs, error: pkgErr } = await (supaAdmin as any)
        .schema("spst")
        .from("packages")
        .select(PACKAGES_SELECT)
        .eq("shipment_id", id)
        .order("created_at", { ascending: true });

      if (pkgErr) return NextResponse.json({ ok: false, error: pkgErr.message }, { status: 500 });

      return NextResponse.json({
        ok: true,
        shipment_id: id,
        colli_n: ship.colli_n ?? (pkgs?.length ?? 0),
        peso_reale_kg: ship.peso_reale_kg ?? null,
        colli: pkgs ?? [],
        scope: "staff",
      });
    }

    // client mode (RLS su shipments + packages)
    const { data: ship, error: shipErr } = await supa
      .from("shipments")
      .select("id, colli_n, peso_reale_kg")
      .eq("id", id)
      .single();

    if (shipErr || !ship) return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404 });

    const { data: pkgs, error: pkgErr } = await supa
      .from("packages")
      .select(PACKAGES_SELECT)
      .eq("shipment_id", id)
      .order("created_at", { ascending: true });

    if (pkgErr) return NextResponse.json({ ok: false, error: pkgErr.message }, { status: 500 });

    return NextResponse.json({
      ok: true,
      shipment_id: id,
      colli_n: ship.colli_n ?? (pkgs?.length ?? 0),
      peso_reale_kg: ship.peso_reale_kg ?? null,
      colli: pkgs ?? [],
      scope: "client",
    });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: "SERVER_ERROR", details: String(e?.message || e) },
      { status: 500 }
    );
  }
}

/* ───────────── PUT: replace totale colli ─────────────
   - CLIENT: può modificare solo le sue spedizioni (check ownership) ma scrittura avviene via service role
   - STAFF: può modificare tutto
*/
export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const id = params.id;
  if (!id) return NextResponse.json({ ok: false, error: "MISSING_ID" }, { status: 400 });

  const supaSession = supabaseServerSpst();
  const { data: { user } } = await supaSession.auth.getUser();

  if (!user?.id || !user.email) {
    return NextResponse.json({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });
  }

  const staff = await isStaff();

  // validate payload
  let parsed: z.infer<typeof ColliReplaceZ>;
  try {
    parsed = ColliReplaceZ.parse(await req.json());
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: "VALIDATION_ERROR", details: err?.errors ?? err },
      { status: 400 }
    );
  }

  const supaAdmin = admin();

  try {
    // ✅ ownership check (sempre) prima di usare service role per scrivere
    const { data: ship, error: shipErr } = await (supaAdmin as any)
      .schema("spst")
      .from("shipments")
      .select("id, email_norm")
      .eq("id", id)
      .single();

    if (shipErr || !ship) return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404 });

    if (!staff) {
      const me = normalizeEmail(user.email);
      if (!me || ship.email_norm !== me) {
        return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });
      }
    }

    // 1) delete all existing packages
    const { error: delErr } = await (supaAdmin as any)
      .schema("spst")
      .from("packages")
      .delete()
      .eq("shipment_id", id);

    if (delErr) return NextResponse.json({ ok: false, error: delErr.message }, { status: 500 });

    // 2) insert new packages
    const rows = parsed.colli.map((c) => ({
      shipment_id: id,
      contenuto: c.contenuto ?? null,
      peso_reale_kg: c.peso_reale_kg,
      lato1_cm: c.lato1_cm,
      lato2_cm: c.lato2_cm,
      lato3_cm: c.lato3_cm,
    }));

    const { error: insErr } = await (supaAdmin as any)
      .schema("spst")
      .from("packages")
      .insert(rows);

    if (insErr) return NextResponse.json({ ok: false, error: insErr.message }, { status: 500 });

    // 3) read back (trigger DB already recalculated totals on shipments)
    const { data: ship2 } = await (supaAdmin as any)
      .schema("spst")
      .from("shipments")
      .select("id, colli_n, peso_reale_kg")
      .eq("id", id)
      .single();

    const { data: pkgs2 } = await (supaAdmin as any)
      .schema("spst")
      .from("packages")
      .select(PACKAGES_SELECT)
      .eq("shipment_id", id)
      .order("created_at", { ascending: true });

    return NextResponse.json({
      ok: true,
      shipment_id: id,
      colli_n: ship2?.colli_n ?? (pkgs2?.length ?? rows.length),
      peso_reale_kg: ship2?.peso_reale_kg ?? null,
      colli: pkgs2 ?? [],
      scope: staff ? "staff" : "client",
    });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: "SERVER_ERROR", details: String(e?.message || e) },
      { status: 500 }
    );
  }
}
