// app/api/spedizioni/[id]/allegati/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const runtime = "nodejs"; export { runtime };
export const dynamic = "force-dynamic";
export const revalidate = 0;

const att = (x:any) => {
  if (!x) return null;
  if (typeof x === "string") return { url: x };
  if (typeof x.url === "string" && x.url.trim()) {
    const o:any = { url: String(x.url).trim() };
    if (x.filename) o.filename = String(x.filename);
    if (x.mime) o.mime = String(x.mime);
    return o;
  }
  return null;
};

export async function PATCH(req: Request, ctx: { params: { id: string } }) {
  try {
    const body = await req.json().catch(() => ({}));
    const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
    const SRV = process.env.SUPABASE_SERVICE_ROLE || process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!SUPABASE_URL || !SRV) {
      return NextResponse.json({ ok:false, error:"MISSING_SUPABASE_CREDS" }, { status:500 });
    }
    const supa = createClient(SUPABASE_URL, SRV, { auth: { persistSession: false } }) as any;

    const patch:any = {};
    if ("ldv"                 in body) patch.ldv                 = att(body.ldv);
    if ("fattura_proforma"    in body) patch.fattura_proforma    = att(body.fattura_proforma);
    if ("fattura_commerciale" in body) patch.fattura_commerciale = att(body.fattura_commerciale);
    if ("dle"                 in body) patch.dle                 = att(body.dle);
    if ("allegato1"           in body) patch.allegato1           = att(body.allegato1);
    if ("allegato2"           in body) patch.allegato2           = att(body.allegato2);
    if ("allegato3"           in body) patch.allegato3           = att(body.allegato3);
    if ("allegato4"           in body) patch.allegato4           = att(body.allegato4);

    if (Object.keys(patch).length === 0) {
      return NextResponse.json({ ok:false, error:"EMPTY_PATCH" }, { status:400 });
    }

    const { data, error } = await supa
      .schema("spst").from("shipments")
      .update(patch)
      .eq("id", ctx.params.id)
      .select("id, human_id, ldv, fattura_proforma, fattura_commerciale, dle, allegato1, allegato2, allegato3, allegato4")
      .single();

    if (error) throw error;

    return NextResponse.json({ ok:true, shipment:data });
  } catch (e:any) {
    console.error("[API/allegati:PATCH] unexpected:", e);
    return NextResponse.json({ ok:false, error:String(e?.message||e) }, { status:500 });
  }
}
