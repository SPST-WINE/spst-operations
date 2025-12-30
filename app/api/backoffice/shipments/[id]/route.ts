import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireStaff } from "@/lib/auth/requireStaff";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

function withCorsHeaders(init?: HeadersInit) {
  return { ...(init || {}), "Access-Control-Allow-Origin": "*" } as Record<string, string>;
}

function isUuid(x: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(x);
}

function admin() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing SUPABASE_URL/SERVICE_ROLE");
  return createClient(url, key, { auth: { persistSession: false } }) as any;
}

const normAtt = (j: any) => (j && typeof j.url === "string" ? j : null);

export function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type,Authorization",
      "Access-Control-Max-Age": "86400",
    },
  });
}

export async function GET(req: NextRequest, ctx: { params: { id: string } }) {
  try {
    await requireStaff();

    const id = String(ctx?.params?.id || "").trim();
    if (!id || !isUuid(id)) {
      return NextResponse.json({ ok: false, error: "INVALID_ID" }, { status: 400, headers: withCorsHeaders() });
    }

    const sb = admin();

    const { data, error } = await sb
      .schema("spst")
      .from("shipments")
      .select(
        `
        id,created_at,human_id,
        email_cliente,email_norm,
        tipo_spedizione,incoterm,giorno_ritiro,note_ritiro,
        formato_sped,contenuto_generale,
        status,carrier,tracking_code,
        colli_n,peso_reale_kg,
        mittente_rs,mittente_paese,mittente_citta,mittente_cap,mittente_indirizzo,mittente_telefono,mittente_piva,
        dest_rs,dest_paese,dest_citta,dest_cap,dest_indirizzo,dest_telefono,dest_piva,dest_abilitato_import,
        fatt_rs,fatt_piva,fatt_valuta,
        fields,
        ldv,fattura_proforma,fattura_commerciale,dle,
        allegato1,allegato2,allegato3,allegato4,
        packages:packages!packages_shipment_id_fkey(
          id,contenuto,length_cm,width_cm,height_cm,weight_kg,weight_volumetric_kg,weight_tariff_kg,created_at
        )
        `
      )
      .eq("id", id)
      .single();

    if (error) {
      return NextResponse.json({ ok: false, error: "DB_ERROR", details: error.message }, { status: 500, headers: withCorsHeaders() });
    }

    const shipment = {
      ...data,
      attachments: {
        ldv: normAtt((data as any).ldv),
        fattura_proforma: normAtt((data as any).fattura_proforma),
        fattura_commerciale: normAtt((data as any).fattura_commerciale),
        dle: normAtt((data as any).dle),
        allegato1: normAtt((data as any).allegato1),
        allegato2: normAtt((data as any).allegato2),
        allegato3: normAtt((data as any).allegato3),
        allegato4: normAtt((data as any).allegato4),
      },
      packages: Array.isArray((data as any).packages) ? (data as any).packages : [],
      // alias legacy-safe
      extras: (data as any).fields ?? null,
    };

    return NextResponse.json({ ok: true, shipment }, { headers: withCorsHeaders() });
  } catch (e: any) {
    if (e instanceof Response) return e;
    console.error("❌ [backoffice/shipments/:id] GET error:", e?.message || e);
    return NextResponse.json(
      { ok: false, error: "UNEXPECTED_ERROR", details: String(e?.message || e) },
      { status: 500, headers: withCorsHeaders() }
    );
  }
}
