import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireStaff } from "@/lib/auth/requireStaff";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

function withCorsHeaders(init?: HeadersInit) {
  return {
    ...(init || {}),
    "Access-Control-Allow-Origin": "*",
  } as Record<string, string>;
}

function admin() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE ||
    process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) throw new Error("Missing SUPABASE_URL/SERVICE_ROLE");

  return createClient(url, key, { auth: { persistSession: false } }) as any;
}

function normAtt(j: any) {
  return j && typeof j.url === "string" ? j : null;
}

export async function GET(req: Request) {
  try {
    await requireStaff();

    const url = new URL(req.url);
    const q = (url.searchParams.get("q") || "").trim();
    const sort = url.searchParams.get("sort") || "created_desc";
    const limit = Math.min(500, Math.max(1, Number(url.searchParams.get("limit") || 200)));

    const sb = admin();

    let query = sb
      .schema("spst")
      .from("shipments")
      .select(
        `
        id,created_at,human_id,
        email_cliente,email_norm,
        tipo_spedizione,
        mittente_paese,mittente_citta,
        dest_paese,dest_citta,
        colli_n,formato_sped,
        carrier,tracking_code,
        status,
        giorno_ritiro,
        ldv,fattura_proforma,fattura_commerciale,dle,
        allegato1,allegato2,allegato3,allegato4
        `
      )
      .limit(limit);

    if (q) {
      const like = `%${q}%`;
      query = query.or(
        [
          `human_id.ilike.${like}`,
          `email_cliente.ilike.${like}`,
          `email_norm.ilike.${like}`,
          `mittente_citta.ilike.${like}`,
          `mittente_paese.ilike.${like}`,
          `dest_citta.ilike.${like}`,
          `dest_paese.ilike.${like}`,
          `carrier.ilike.${like}`,
          `tracking_code.ilike.${like}`,
        ].join(",")
      );
    }

    if (sort === "created_asc") {
      query = query.order("created_at", { ascending: true, nullsFirst: true });
    } else {
      query = query.order("created_at", { ascending: false, nullsFirst: true });
    }

    const { data, error } = await query;
    if (error) throw error;

    const rows = (data || []).map((r: any) => ({
      id: r.id,
      created_at: r.created_at,
      human_id: r.human_id,
      email_cliente: r.email_cliente,
      email_norm: r.email_norm,
      tipo_spedizione: r.tipo_spedizione,
      mittente_paese: r.mittente_paese,
      mittente_citta: r.mittente_citta,
      dest_paese: r.dest_paese,
      dest_citta: r.dest_citta,
      colli_n: r.colli_n,
      formato_sped: r.formato_sped,
      carrier: r.carrier ?? null,
      tracking_code: r.tracking_code ?? null,
      status: r.status ?? null,
      giorno_ritiro: r.giorno_ritiro ?? null,
      attachments: {
        ldv: normAtt(r.ldv),
        fattura_proforma: normAtt(r.fattura_proforma),
        fattura_commerciale: normAtt(r.fattura_commerciale),
        dle: normAtt(r.dle),
        allegato1: normAtt(r.allegato1),
        allegato2: normAtt(r.allegato2),
        allegato3: normAtt(r.allegato3),
        allegato4: normAtt(r.allegato4),
      },
    }));

    return NextResponse.json({ ok: true, rows }, { headers: withCorsHeaders() });
  } catch (e: any) {
    console.error("❌ [backoffice/shipments] GET error:", e?.message || e);
    return NextResponse.json(
      { ok: false, error: "UNEXPECTED_ERROR", details: String(e?.message || e) },
      { status: 500, headers: withCorsHeaders() }
    );
  }
}
