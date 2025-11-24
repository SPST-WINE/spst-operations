import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

function envOrThrow(name: string): string {
  const v = process.env[name];
  if (!v || v.trim() === "") {
    throw new Error(`Missing env ${name}`);
  }
  return v;
}

function admin() {
  const url = envOrThrow("NEXT_PUBLIC_SUPABASE_URL");
  const key =
    process.env.SUPABASE_SERVICE_ROLE || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key || key.trim() === "") {
    throw new Error("Missing env SUPABASE_SERVICE_ROLE(_KEY)");
  }

  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export async function GET(
  req: Request,
  ctx: { params: { id: string } }
) {
  const id = ctx.params?.id;

  if (!id) {
    return NextResponse.json(
      { ok: false, error: "MISSING_ID" },
      { status: 400 }
    );
  }

  try {
    const supa = admin();

    const { data, error } = await supa
      .schema("spst")
      .from("shipments")
      .select(
        `
        id, created_at, human_id,
        email_cliente, email_norm,
        status, carrier, tracking_code,
        tipo_spedizione, incoterm, giorno_ritiro, note_ritiro,
        mittente_paese, mittente_citta, mittente_cap, mittente_indirizzo,
        mittente_rs, mittente_referente, mittente_telefono, mittente_piva,
        dest_paese, dest_citta, dest_cap,
        dest_rs, dest_referente, dest_telefono, dest_piva, dest_abilitato_import,
        fatt_rs, fatt_referente, fatt_paese, fatt_citta, fatt_cap,
        fatt_indirizzo, fatt_telefono, fatt_piva, fatt_valuta,
        colli_n, peso_reale_kg, formato_sped, contenuto_generale,
        ldv, fattura_proforma, fattura_commerciale, dle,
        allegato1, allegato2, allegato3, allegato4,
        fields,
        packages:packages!packages_shipment_id_fkey(id,l1,l2,l3,weight_kg)
      `
      )
      .eq("id", id)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return NextResponse.json(
          { ok: false, error: "NOT_FOUND" },
          { status: 404 }
        );
      }
      console.error("[API/spedizioni/:id] db error:", error);
      return NextResponse.json(
        { ok: false, error: "DB_ERROR", details: error.message },
        { status: 500 }
      );
    }

    if (!data) {
      return NextResponse.json(
        { ok: false, error: "NOT_FOUND" },
        { status: 404 }
      );
    }

    // --------------------------------------------------
    // Estrazione e normalizzazione del JSON "fields"
    // --------------------------------------------------
    const f: any = (data as any).fields || {};
    const mittenteJson: any = f.mittente || {};
    const destJson: any = f.destinatario || {};
    const fattJson: any = f.fatturazione || {};

    const giorno_ritiro =
      data.giorno_ritiro || f.ritiroData || null;
    const note_ritiro =
      data.note_ritiro || f.ritiroNote || null;

    const mittente_indirizzo =
      data.mittente_indirizzo || mittenteJson.indirizzo || null;

    const dest_indirizzo =
      destJson.indirizzo || null;

    const fatt_indirizzo =
      data.fatt_indirizzo || fattJson.indirizzo || null;

    const dest_abilitato_import =
      data.dest_abilitato_import ??
      f.destAbilitato ??
      null;

    // piccolo helper per gli allegati (jsonb) –
    // se in futuro decidi di salvarci solo l'URL basterà adattare qui
    const wrapFile = (v: any) => {
      if (!v) return null;
      if (typeof v === "string") return { url: v };
      if (typeof v === "object" && v !== null) return v;
      return null;
    };

    const shipment = {
      id: data.id,
      created_at: data.created_at,
      human_id: data.human_id,
      email_cliente: data.email_cliente,
      email_norm: data.email_norm,

      status: data.status,
      carrier: data.carrier,
      tracking_code: data.tracking_code,

      tipo_spedizione: data.tipo_spedizione,
      incoterm: data.incoterm,
      giorno_ritiro,
      note_ritiro,

      mittente_rs: data.mittente_rs,
      mittente_paese: data.mittente_paese,
      mittente_citta: data.mittente_citta,
      mittente_cap: data.mittente_cap,
      mittente_indirizzo,
      mittente_telefono: data.mittente_telefono,
      mittente_piva: data.mittente_piva,

      dest_rs: data.dest_rs,
      dest_paese: data.dest_paese,
      dest_citta: data.dest_citta,
      dest_cap: data.dest_cap,
      dest_indirizzo,
      dest_telefono: data.dest_telefono,
      dest_piva: data.dest_piva,
      dest_abilitato_import,

      fatt_rs: data.fatt_rs,
      fatt_paese: data.fatt_paese,
      fatt_citta: data.fatt_citta,
      fatt_cap: data.fatt_cap,
      fatt_indirizzo,
      fatt_telefono: data.fatt_telefono,
      fatt_piva: data.fatt_piva,
      fatt_valuta: data.fatt_valuta,

      colli_n: data.colli_n,
      peso_reale_kg: data.peso_reale_kg,
      formato_sped: data.formato_sped,
      contenuto_generale: data.contenuto_generale,

      attachments: {
        ldv: wrapFile(data.ldv),
        fattura_proforma: wrapFile(data.fattura_proforma),
        fattura_commerciale: wrapFile(data.fattura_commerciale),
        dle: wrapFile(data.dle),
        allegato1: wrapFile(data.allegato1),
        allegato2: wrapFile(data.allegato2),
        allegato3: wrapFile(data.allegato3),
        allegato4: wrapFile(data.allegato4),
      },

      packages: data.packages || [],
    };

    return NextResponse.json({ ok: true, shipment }, { status: 200 });
  } catch (e: any) {
    console.error("[API/spedizioni/:id] unexpected:", e);
    return NextResponse.json(
      {
        ok: false,
        error: "UNEXPECTED_ERROR",
        details: String(e?.message || e),
      },
      { status: 500 }
    );
  }
}
