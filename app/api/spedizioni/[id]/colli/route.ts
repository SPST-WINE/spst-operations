// app/api/spedizioni/[id]/colli/route.ts
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

function toNum(x: any): number | null {
  if (x === null || x === undefined) return null;
  const n = Number(x);
  return Number.isFinite(n) ? n : null;
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

function mapPackageRow(p: any) {
  return {
    id: p.id,
    shipment_id: p.shipment_id,
    contenuto: p.contenuto ?? null,

    // ✅ API espone nomi "legacy" (no breaking changes)
    peso_reale_kg: p.weight_kg ?? null,
    lato1_cm: p.length_cm ?? null,
    lato2_cm: p.width_cm ?? null,
    lato3_cm: p.height_cm ?? null,

    created_at: p.created_at,
  };
}

/* ───────────── GET /api/spedizioni/[id]/colli ─────────────
   Source-of-truth DB = spst.packages (weight_kg/length_cm/width_cm/height_cm)
   Output API = legacy shape (peso_reale_kg/latoX_cm) tramite mapping
*/
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const id = params.id;
  if (!id)
    return NextResponse.json({ ok: false, error: "MISSING_ID" }, { status: 400 });

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

  try {
    if (staff) {
      const supaAdmin = admin();

      // ✅ packages (DB columns reali)
      const { data: packages, error: pkgErr } = await (supaAdmin as any)
        .schema("spst")
        .from("packages")
        .select(
          "id, shipment_id, contenuto, weight_kg, length_cm, width_cm, height_cm, created_at"
        )
        .eq("shipment_id", id)
        .order("created_at", { ascending: true });

      if (pkgErr) {
        return NextResponse.json(
          { ok: false, error: pkgErr.message },
          { status: 500 }
        );
      }

      const mapped = (packages ?? []).map(mapPackageRow);

      // shipment aggregates (optional)
      const { data: ship, error: shipErr } = await (supaAdmin as any)
        .schema("spst")
        .from("shipments")
        .select("id, colli_n, peso_reale_kg")
        .eq("id", id)
        .single();

      if (shipErr) {
        return NextResponse.json({
          ok: true,
          shipment: null,
          packages: mapped,
          scope: "staff",
        });
      }

      return NextResponse.json({
        ok: true,
        shipment: ship ?? null,
        packages: mapped,
        scope: "staff",
      });
    }

    // client mode (RLS): packages
    const { data: packages, error: pkgErr } = await supa
      .from("packages")
      .select(
        "id, shipment_id, contenuto, weight_kg, length_cm, width_cm, height_cm, created_at"
      )
      .eq("shipment_id", id)
      .order("created_at", { ascending: true });

    if (pkgErr) {
      return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404 });
    }

    const mapped = (packages ?? []).map(mapPackageRow);

    const { data: ship, error: shipErr } = await supa
      .from("shipments")
      .select("id, colli_n, peso_reale_kg")
      .eq("id", id)
      .single();

    if (shipErr) {
      return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404 });
    }

    return NextResponse.json({
      ok: true,
      shipment: ship ?? null,
      packages: mapped,
      scope: "client",
    });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: "SERVER_ERROR", details: String(e?.message || e) },
      { status: 500 }
    );
  }
}

/* ───────────── PUT /api/spedizioni/[id]/colli ─────────────
   Replace totale colli (staff-only).
   - Delete packages esistenti
   - Insert nuovi packages (DB columns reali)
   - Return state mappato in legacy shape (no breaking)
*/
export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const staff = await requireStaff();
  if ("response" in staff) return staff.response;

  const id = params.id;
  if (!id)
    return NextResponse.json({ ok: false, error: "MISSING_ID" }, { status: 400 });

  const body = await req.json().catch(() => ({} as any));
  const raw = Array.isArray(body?.packages)
    ? body.packages
    : Array.isArray(body?.colli)
      ? body.colli
      : [];

  const rows = raw
    .map((c: any) => {
      const peso = toNum(c?.peso_reale_kg ?? c?.peso_kg ?? c?.peso);
      const l1 = toNum(c?.lato1_cm ?? c?.l1 ?? c?.length_cm ?? c?.lunghezza);
      const l2 = toNum(c?.lato2_cm ?? c?.l2 ?? c?.width_cm ?? c?.larghezza);
      const l3 = toNum(c?.lato3_cm ?? c?.l3 ?? c?.height_cm ?? c?.altezza);
      const contenuto =
        (c?.contenuto ?? c?.content ?? c?.descrizione ?? "").toString().trim() ||
        null;

      if (!peso || !l1 || !l2 || !l3) return null;
      if (peso <= 0 || l1 <= 0 || l2 <= 0 || l3 <= 0) return null;

      // ✅ DB columns reali
      return {
        shipment_id: id,
        contenuto,
        weight_kg: peso,
        length_cm: l1,
        width_cm: l2,
        height_cm: l3,
      };
    })
    .filter(Boolean) as any[];

  try {
    const supaAdmin = admin();

    // 1) delete old
    const { error: delErr } = await (supaAdmin as any)
      .schema("spst")
      .from("packages")
      .delete()
      .eq("shipment_id", id);

    if (delErr) {
      return NextResponse.json(
        { ok: false, error: "DELETE_FAILED", details: delErr.message },
        { status: 500 }
      );
    }

    // 2) insert new
    if (rows.length > 0) {
      const { error: insErr } = await (supaAdmin as any)
        .schema("spst")
        .from("packages")
        .insert(rows);

      if (insErr) {
        return NextResponse.json(
          { ok: false, error: "INSERT_FAILED", details: insErr.message },
          { status: 500 }
        );
      }
    }

    // 3) return fresh state (✅ select DB columns reali)
    const { data: packages, error: pkgErr } = await (supaAdmin as any)
      .schema("spst")
      .from("packages")
      .select(
        "id, shipment_id, contenuto, weight_kg, length_cm, width_cm, height_cm, created_at"
      )
      .eq("shipment_id", id)
      .order("created_at", { ascending: true });

    if (pkgErr) {
      return NextResponse.json(
        { ok: false, error: "PACKAGES_SELECT_FAILED", details: pkgErr.message },
        { status: 500 }
      );
    }

    const mapped = (packages ?? []).map(mapPackageRow);

    const { data: ship, error: shipErr } = await (supaAdmin as any)
      .schema("spst")
      .from("shipments")
      .select("id, colli_n, peso_reale_kg")
      .eq("id", id)
      .single();

    if (shipErr) {
      return NextResponse.json(
        { ok: false, error: "SHIPMENT_SELECT_FAILED", details: shipErr.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      shipment: ship ?? null,
      packages: mapped,
    });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: "SERVER_ERROR", details: String(e?.message || e) },
      { status: 500 }
    );
  }
}
