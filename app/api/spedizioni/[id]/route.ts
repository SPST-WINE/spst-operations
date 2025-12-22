// app/api/spedizioni/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabaseServerSpst } from "@/lib/supabase/server";
import { requireStaff } from "@/lib/auth/requireStaff";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

function admin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
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

// Normalizza un attachment che può essere string (url puro) o json
function wrapFile(raw: any) {
  if (!raw) return null;
  if (typeof raw === "string") return { url: raw as string };
  if (typeof raw === "object") {
    const obj = raw as any;
    return {
      url: obj.url || obj.path || "",
      file_name: obj.file_name || obj.name || obj.filename || null,
      content_type: obj.content_type || obj.mime || null,
      size: obj.size || null,
      updated_at: obj.updated_at || obj.updatedAt || null,
      ...obj,
    };
  }
  return null;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const id = params.id;
  if (!id) {
    return NextResponse.json({ ok: false, error: "ID spedizione mancante" }, { status: 400 });
  }

  // deve essere loggato (client o staff)
  const supa = supabaseServerSpst();
  const {
    data: { user },
  } = await supa.auth.getUser();

  if (!user?.id) {
    return NextResponse.json({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });
  }

  const staff = await isStaff();

  try {
    if (staff) {
      const supaAdmin = admin();
      const { data, error } = await supaAdmin
        .schema("spst")
        .from("shipments")
        .select(
          `
          id,created_at,human_id,
          email_cliente,email_norm,
          status,carrier,tracking_code,declared_value,
          tipo_spedizione,incoterm,giorno_ritiro,note_ritiro,
          mittente_rs,mittente_paese,mittente_citta,mittente_cap,mittente_indirizzo,mittente_telefono,mittente_piva,
          dest_rs,dest_paese,dest_citta,dest_cap,dest_telefono,dest_piva,
          fatt_rs,fatt_piva,fatt_valuta,
          colli_n,peso_reale_kg,
          ldv,fattura_proforma,fattura_commerciale,dle,allegato1,allegato2,allegato3,allegato4,
          fields
        `
        )
        .eq("id", id)
        .single();

      if (error) {
        return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
      }

      const row: any = data || null;
      if (!row) return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404 });

      // normalizza attachments
      row.ldv = wrapFile(row.ldv);
      row.fattura_proforma = wrapFile(row.fattura_proforma);
      row.fattura_commerciale = wrapFile(row.fattura_commerciale);
      row.dle = wrapFile(row.dle);
      row.allegato1 = wrapFile(row.allegato1);
      row.allegato2 = wrapFile(row.allegato2);
      row.allegato3 = wrapFile(row.allegato3);
      row.allegato4 = wrapFile(row.allegato4);

      return NextResponse.json({ ok: true, shipment: row, scope: "staff" });
    }

    // client: RLS
    const { data, error } = await supa
      .from("shipments")
      .select(
        `
        id,created_at,human_id,
        email_cliente,email_norm,
        status,carrier,tracking_code,declared_value,
        tipo_spedizione,incoterm,giorno_ritiro,note_ritiro,
        mittente_rs,mittente_paese,mittente_citta,mittente_cap,mittente_indirizzo,mittente_telefono,mittente_piva,
        dest_rs,dest_paese,dest_citta,dest_cap,dest_telefono,dest_piva,
        fatt_rs,fatt_piva,fatt_valuta,
        colli_n,peso_reale_kg,
        ldv,fattura_proforma,fattura_commerciale,dle,allegato1,allegato2,allegato3,allegato4,
        fields
      `
      )
      .eq("id", id)
      .single();

    if (error) {
      // se non è owner, RLS spesso produce "no rows" o 406/404
      return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404 });
    }

    const row: any = data || null;
    if (!row) return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404 });

    row.ldv = wrapFile(row.ldv);
    row.fattura_proforma = wrapFile(row.fattura_proforma);
    row.fattura_commerciale = wrapFile(row.fattura_commerciale);
    row.dle = wrapFile(row.dle);
    row.allegato1 = wrapFile(row.allegato1);
    row.allegato2 = wrapFile(row.allegato2);
    row.allegato3 = wrapFile(row.allegato3);
    row.allegato4 = wrapFile(row.allegato4);

    return NextResponse.json({ ok: true, shipment: row, scope: "client" });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: "SERVER_ERROR", details: String(e?.message || e) },
      { status: 500 }
    );
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  // staff-only
  const staff = await requireStaff();
  if ("response" in staff) return staff.response;

  const id = params.id;
  if (!id) {
    return NextResponse.json({ ok: false, error: "ID spedizione mancante" }, { status: 400 });
  }

  const payload = await req.json().catch(() => ({} as any));

  try {
    const supaAdmin = admin();
    const { data, error } = await supaAdmin
      .schema("spst")
      .from("shipments")
      .update(payload)
      .eq("id", id)
      .select()
      .single();

    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

    return NextResponse.json({ ok: true, shipment: data });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: "SERVER_ERROR", details: String(e?.message || e) },
      { status: 500 }
    );
  }
}
