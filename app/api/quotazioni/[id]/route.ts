// app/api/quotazioni/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabaseServerSpst } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

// ---------- Helpers -------------------------------------------------

function makeSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    console.error("[API/quotazioni/:id] Missing Supabase env", {
      hasUrl: !!url,
      hasKey: !!key,
    });
    return null;
  }

  return createClient(url, key, {
    auth: { persistSession: false },
    db: { schema: "spst" },
  });
}

function jsonError(status: number, error: string, extra?: Record<string, any>) {
  return NextResponse.json({ ok: false, error, ...extra }, { status });
}

// Normalizza gli stati delle quotazioni ai valori standard
function normalizeQuoteStatus(status?: string | null): string {
  const s = (status || "").trim().toUpperCase();
  
  // Mappa vecchi valori ai nuovi
  if (s === "IN LAVORAZIONE" || s === "IN_LAVORAZIONE" || s.includes("LAVORAZIONE")) {
    return "IN LAVORAZIONE";
  }
  if (s === "DISPONIBILE" || s.includes("DISPONIBILE")) {
    return "DISPONIBILE";
  }
  if (s === "ACCETTATA" || s === "ACCEPTED" || s.includes("ACCETTATA")) {
    return "ACCETTATA";
  }
  
  // Default per quotazioni esistenti senza stato chiaro
  return "IN LAVORAZIONE";
}

// ---------- GET: dettaglio preventivo -------------------------------

export async function GET(req: NextRequest, ctx: { params: { id: string } }) {
  const id = decodeURIComponent((ctx.params?.id || "").trim());
  if (!id) return jsonError(400, "MISSING_ID");

  const supabase = makeSupabase();
  if (!supabase) {
    return jsonError(500, "MISSING_SUPABASE_ENV", {
      message:
        "Variabili Supabase mancanti (NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE).",
    });
  }

  // ✅ Verifica autenticazione e ownership
  const supa = supabaseServerSpst();
  const { data: userData, error: userErr } = await supa.auth.getUser();
  const userEmail = userData?.user?.email ? String(userData.user.email) : null;

  if (userErr || !userEmail) {
    return jsonError(401, "UNAUTHENTICATED", {
      message: "Autenticazione richiesta",
    });
  }

  const emailNorm = userEmail.toLowerCase().trim();

  const supabase = makeSupabase();
  if (!supabase) {
    return jsonError(500, "MISSING_SUPABASE_ENV", {
      message:
        "Variabili Supabase mancanti (NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE).",
    });
  }

  try {
    // ✅ Leggi anche quote_options disponibili
    const { data: optionsData } = await supabase
      .from("quote_options")
      .select("*")
      .eq("quote_id", id)
      .order("created_at", { ascending: true });
    const { data, error } = await supabase
      .from("quotes")
      .select("id, status, fields, created_at, incoterm, declared_value, email_cliente, destinatario, formato_sped, colli_n, accepted_option_id")
      .eq("id", id)
      .eq("email_cliente", emailNorm) // ✅ Solo le quotazioni del cliente autenticato
      .single();

    if (error) {
      console.error("[API/quotazioni/:id] DB_ERROR", error);
      if ((error as any).code === "PGRST116") {
        return jsonError(404, "NOT_FOUND");
      }
      return jsonError(500, "DB_ERROR", { details: error.message });
    }

    if (!data) return jsonError(404, "NOT_FOUND");

    const f: any = data.fields || {};
    const mitt = f.mittente || {};
    const dest = f.destinatario || {};
    const colli = Array.isArray(f.colli) ? f.colli : [];

    const valoreAssicurato =
  data.declared_value != null
    ? Number(data.declared_value)
    : (f.valoreAssicurato != null ? Number(f.valoreAssicurato) : null);

const assicurazioneAttiva =
  !!valoreAssicurato && Number.isFinite(valoreAssicurato) && valoreAssicurato > 0;


    // Normalizza stato
    const normalizedStatus = normalizeQuoteStatus(data.status);

    const fields = {
      ...f,

      // alias esistenti
      Stato: normalizedStatus,
      Destinatario_Nome: dest.ragioneSociale,
      Destinatario_Citta: dest.citta,
      Destinatario_Paese: dest.paese,
      Mittente_Nome: mitt.ragioneSociale,
      "Creato il": data.created_at,
      "Creato da Email": f.createdByEmail,
      Slug_Pubblico: data.id,
      Incoterm: data.incoterm,

      // ✅ nuovi alias
      assicurazioneAttiva,
      valoreAssicurato,
      Assicurazione_Attiva: assicurazioneAttiva ? "Sì" : "No",
      Valore_Assicurato: valoreAssicurato,
    };

    // ✅ Leggi tutte le quote_options disponibili
    const { data: optionsData } = await supabase
      .from("quote_options")
      .select("*")
      .eq("quote_id", id)
      .order("total_price", { ascending: true });

    // ✅ Leggi opzione accettata se presente
    let acceptedOption = null;
    if (data.accepted_option_id) {
      acceptedOption = optionsData?.find((o: any) => o.id === data.accepted_option_id) || null;
    }

    const row = {
      id: data.id,
      displayId: data.id,
      status: normalizedStatus,
      fields,
      colli,
      destinatario: data.destinatario || dest,
      formato_sped: data.formato_sped || f.formato || null,
      colli_n: data.colli_n || (Array.isArray(f.colli) ? f.colli.length : null),
      accepted_option: acceptedOption,
      available_options: Array.isArray(optionsData) 
        ? optionsData.filter((o: any) => o.visible_to_client !== false)
        : [],
    };

    return NextResponse.json({ ok: true, row }, { status: 200 });
  } catch (e: any) {
    console.error("[API/quotazioni/:id] ERROR", e?.message || e);
    return jsonError(500, "SERVER_ERROR", { message: e?.message });
  }
}

// ---------- POST: accetta quotazione -----------------------------------

export async function POST(
  req: NextRequest,
  ctx: { params: { id: string } }
) {
  const id = decodeURIComponent((ctx.params?.id || "").trim());
  if (!id) return jsonError(400, "MISSING_ID");

  // ✅ Verifica autenticazione
  const supa = supabaseServerSpst();
  const { data: userData, error: userErr } = await supa.auth.getUser();
  const userEmail = userData?.user?.email ? String(userData.user.email) : null;

  if (userErr || !userEmail) {
    return jsonError(401, "UNAUTHENTICATED", {
      message: "Autenticazione richiesta",
    });
  }

  const emailNorm = userEmail.toLowerCase().trim();

  const supabase = makeSupabase();
  if (!supabase) {
    return jsonError(500, "MISSING_SUPABASE_ENV");
  }

  try {
    const body = await req.json().catch(() => ({}));
    const optionId = body.option_id || body.optionId;

    if (!optionId) {
      return jsonError(400, "MISSING_OPTION_ID", {
        message: "option_id è obbligatorio",
      });
    }

    // ✅ Verifica che la quotazione appartenga al cliente
    const { data: quote, error: quoteErr } = await supabase
      .from("quotes")
      .select("id, status, email_cliente")
      .eq("id", id)
      .eq("email_cliente", emailNorm)
      .single();

    if (quoteErr || !quote) {
      return jsonError(404, "QUOTE_NOT_FOUND", {
        message: "Quotazione non trovata o non autorizzata",
      });
    }

    // ✅ Verifica che l'opzione appartenga alla quotazione
    const { data: option, error: optionErr } = await supabase
      .from("quote_options")
      .select("id, quote_id, status")
      .eq("id", optionId)
      .eq("quote_id", id)
      .single();

    if (optionErr || !option) {
      return jsonError(404, "OPTION_NOT_FOUND", {
        message: "Opzione non trovata",
      });
    }

    const now = new Date().toISOString();

    // ✅ Aggiorna quotazione
    const { error: upQuoteErr } = await supabase
      .from("quotes")
      .update({
        status: "ACCETTATA",
        accepted_option_id: optionId,
        updated_at: now,
      })
      .eq("id", id);

    if (upQuoteErr) {
      console.error("[API/quotazioni/:id:POST] update quote error", upQuoteErr);
      return jsonError(500, "UPDATE_QUOTE_ERROR", {
        message: upQuoteErr.message,
      });
    }

    // ✅ Aggiorna opzione scelta
    const { error: upOptErr } = await supabase
      .from("quote_options")
      .update({
        status: "accettata",
        accepted_at: now,
        updated_at: now,
      })
      .eq("id", optionId);

    if (upOptErr) {
      console.error("[API/quotazioni/:id:POST] update option error", upOptErr);
      // Non bloccante, ma lo segnalo
    }

    // ✅ Rifiuta altre opzioni
    await supabase
      .from("quote_options")
      .update({
        status: "rifiutata",
        updated_at: now,
      })
      .eq("quote_id", id)
      .neq("id", optionId);

    return NextResponse.json(
      {
        ok: true,
        accepted_option_id: optionId,
      },
      { status: 200 }
    );
  } catch (e: any) {
    console.error("[API/quotazioni/:id:POST] ERROR", e?.message || e);
    return jsonError(500, "SERVER_ERROR", { message: e?.message });
  }
}
