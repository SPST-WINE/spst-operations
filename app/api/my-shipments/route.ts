// app/api/my-shipments/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabaseServerSpst } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

function normalizeEmail(x?: string | null) {
  const v = (x ?? "").trim();
  return v ? v.toLowerCase() : null;
}

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

const SELECT_LIST = `
  id, created_at, human_id,
  tipo_spedizione, incoterm,
  mittente_citta, dest_citta,
  giorno_ritiro,
  colli_n, peso_reale_kg,
  email_cliente, email_norm,
  status, carrier, tracking_code,
  formato_sped
`;

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);

    // compat: prima usavi header x-user-email (ma ora lo rendiamo query/header)
    const headerEmail =
      (req.headers.get("x-user-email") || req.headers.get("x_user_email") || "").trim();
    const emailParam = normalizeEmail(url.searchParams.get("email")) || normalizeEmail(headerEmail);

    const supa = supabaseServerSpst();
    const { data: { user } } = await supa.auth.getUser();

    if (!user?.id) {
      return NextResponse.json({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });
    }

    const staff = await isStaff();

    // STAFF: service role, opzionale filtro email_norm
    if (staff) {
      const supaAdmin = admin();
      let q = (supaAdmin as any)
        .schema("spst")
        .from("shipments")
        .select(SELECT_LIST)
        .order("created_at", { ascending: false })
        .limit(20);

      if (emailParam) q = q.eq("email_norm", emailParam);

      const { data, error } = await q;
      if (error) {
        return NextResponse.json(
          { ok: false, error: "DB_SELECT_FAILED", details: error.message },
          { status: 502 }
        );
      }

      return NextResponse.json({ ok: true, rows: data ?? [], scope: "staff" });
    }

    // CLIENT: RLS → ignora filtro email per sicurezza (uno user = una inbox)
    const { data, error } = await supa
      .from("shipments")
      .select(SELECT_LIST)
      .order("created_at", { ascending: false })
      .limit(20);

    if (error) {
      return NextResponse.json(
        { ok: false, error: "DB_SELECT_FAILED", details: error.message },
        { status: 502 }
      );
    }

    return NextResponse.json({ ok: true, rows: data ?? [], scope: "client" });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: "UNEXPECTED_ERROR", details: String(e?.message || e) },
      { status: 500 }
    );
  }
}
