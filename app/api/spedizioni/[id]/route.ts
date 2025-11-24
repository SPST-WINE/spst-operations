// app/api/spedizioni/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "";
const SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || "";
const SUPABASE_SERVICE_ROLE =
  process.env.SUPABASE_SERVICE_ROLE || process.env.SUPABASE_SERVICE_ROLE_KEY || "";

function makeSupabase() {
  if (!SUPABASE_URL || (!SUPABASE_ANON_KEY && !SUPABASE_SERVICE_ROLE)) {
    throw new Error("Supabase env vars mancanti");
  }
  return createClient(
    SUPABASE_URL,
    SUPABASE_SERVICE_ROLE || SUPABASE_ANON_KEY,
    { auth: { persistSession: false } }
  );
}

// Normalizza un attachment che può essere string (url puro) o json
function wrapFile(raw: any) {
  if (!raw) return null;

  if (typeof raw === "string") {
    return { url: raw as string };
  }

  if (typeof raw === "object") {
    const obj = raw as any;
    return {
      url: obj.url || obj.path || "",
      file_name: obj.file_name || obj.name || null,
      mime_type: obj.mime_type || obj.content_type || null,
      size: obj.size ?? null,
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
    return NextResponse.json(
      { ok: false, error: "ID spedizione mancante" },
      { status: 400 }
    );
  }

  try {
    const supa = makeSupabase();

    const { data, error } = await supa
      .schema("spst")
      .from("shipments")
      .select(
        `
        id,created_at,human_id,
        email_cliente,email_norm,
        status,carrier,tracking_code,
        tipo_spedizione,incoterm,giorno_ritiro,note_ritiro,
        mittente_rs,mittente_paese,mittente_citta,mittente_cap,mittente_indirizzo,
        mittente_telefono,mittente_piva,
        dest_rs,dest_paese,dest_citta,dest_cap,
        dest_telefono,dest_piva,dest_abilitato_import,
        fatt_rs,fatt_paese,fatt_citta,fatt_cap,fatt_indirizzo,
        fatt_telefono,fatt_piva,fatt_valuta,
        colli_n,peso_reale_kg,formato_sped,contenuto_generale,
        fields,
        ldv,fattura_proforma,fattura_commerciale,dle,
        allegato1,allegato2,allegato3,allegato4,
        packages:packages!packages_shipment_id_fkey(id,l1,l2,l3,weight_kg)
      `
      )
      .eq("id", id)
      .single();

    if (error) {
      console.error("[API/spedizioni/:id] db error:", error);
      return NextResponse.json(
        { ok: false, error: "Errore nel recupero della spedizione" },
        { status: 500 }
      );
    }

    if (!data) {
      return NextResponse.json(
        { ok: false, error: "Spedizione non trovata" },
        { status: 404 }
      );
    }

    // fields jsonb
    const fields: any = (data as any).fields || {};
    const mittente = fields.mittente || {};
    const destinatario = fields.destinatario || {};
    const fatturazione = fields.fatturazione || {};

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
      giorno_ritiro: data.giorno_ritiro,
      note_ritiro: data.note_ritiro,

      // MITTENTE
      mittente_rs: data.mittente_rs || mittente.ragioneSociale || null,
      mittente_paese: data.mittente_paese || mittente.paese || null,
      mittente_citta: data.mittente_citta || mittente.citta || null,
      mittente_cap: data.mittente_cap || mittente.cap || null,
      mittente_indirizzo:
        data.mittente_indirizzo || mittente.indirizzo || null,
      mittente_telefono: data.mittente_telefono || mittente.telefono || null,
      mittente_piva: data.mittente_piva || mittente.piva || null,

      // DESTINATARIO
      dest_rs: data.dest_rs || destinatario.ragioneSociale || null,
      dest_paese: data.dest_paese || destinatario.paese || null,
      dest_citta: data.dest_citta || destinatario.citta || null,
      dest_cap: data.dest_cap || destinatario.cap || null,
      dest_indirizzo: destinatario.indirizzo || null,
      dest_telefono: data.dest_telefono || destinatario.telefono || null,
      dest_piva: data.dest_piva || destinatario.piva || null,

      // FATTURAZIONE
      fatt_rs: data.fatt_rs || fatturazione.ragioneSociale || null,
      fatt_paese: data.fatt_paese || fatturazione.paese || null,
      fatt_citta: data.fatt_citta || fatturazione.citta || null,
      fatt_cap: data.fatt_cap || fatturazione.cap || null,
      fatt_indirizzo: data.fatt_indirizzo || fatturazione.indirizzo || null,
      fatt_telefono: data.fatt_telefono || fatturazione.telefono || null,
      fatt_piva: data.fatt_piva || fatturazione.piva || null,
      fatt_valuta: data.fatt_valuta || fields.valuta || null,

      // DETTAGLIO SPEDIZIONE
      colli_n: data.colli_n,
      peso_reale_kg: data.peso_reale_kg,
      formato_sped: data.formato_sped || fields.formato || null,
      contenuto_generale: data.contenuto_generale || fields.contenuto || null,
       dest_abilitato_import:
        data.dest_abilitato_import ??
        (typeof fields.destAbilitato === "boolean"
          ? fields.destAbilitato
          : null),

      // Espongo anche il jsonb completo per packing list & debug
      fields,

      // ATTACHMENTS
      attachments: {
        ldv: wrapFile((data as any).ldv),
        fattura_proforma: wrapFile((data as any).fattura_proforma),
        fattura_commerciale: wrapFile((data as any).fattura_commerciale),
        dle: wrapFile((data as any).dle),
        allegato1: wrapFile((data as any).allegato1),
        allegato2: wrapFile((data as any).allegato2),
        allegato3: wrapFile((data as any).allegato3),
        allegato4: wrapFile((data as any).allegato4),
      },

      // COLLI
      packages: Array.isArray((data as any).packages)
        ? (data as any).packages.map((p: any) => ({
            id: p.id,
            l1: p.l1,
            l2: p.l2,
            l3: p.l3,
            weight_kg: p.weight_kg,
          }))
        : [],
    };

    return NextResponse.json({ ok: true, shipment });
  } catch (e) {
    console.error("[API/spedizioni/:id] unexpected error:", e);
    return NextResponse.json(
      { ok: false, error: "Errore interno" },
      { status: 500 }
    );
  }
}

// PATCH: aggiorna corriere + tracking
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const id = params.id;

  if (!id) {
    return NextResponse.json(
      { ok: false, error: "ID spedizione mancante" },
      { status: 400 }
    );
  }

  try {
    const body = await req.json().catch(() => ({}));
    const carrier =
      typeof body.carrier === "string" && body.carrier.trim() !== ""
        ? body.carrier.trim()
        : null;
    const tracking_code =
      typeof body.tracking_code === "string" && body.tracking_code.trim() !== ""
        ? body.tracking_code.trim()
        : null;

    const supa = makeSupabase();

    const { data, error } = await supa
      .schema("spst")
      .from("shipments")
      .update({ carrier, tracking_code })
      .eq("id", id)
      .select("carrier,tracking_code")
      .single();

    if (error) {
      console.error("[API/spedizioni/:id] PATCH db error:", error);
      return NextResponse.json(
        { ok: false, error: "Errore nel salvataggio dei dati" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      carrier: data?.carrier ?? carrier,
      tracking_code: data?.tracking_code ?? tracking_code,
    });
  } catch (e) {
    console.error("[API/spedizioni/:id] PATCH unexpected error:", e);
    return NextResponse.json(
      { ok: false, error: "Errore interno" },
      { status: 500 }
    );
  }
}
