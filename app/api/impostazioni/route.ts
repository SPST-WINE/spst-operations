// app/api/impostazioni/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

// --- Helpers -----------------------------------------------------

function makeSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    console.error("[API/impostazioni] Missing Supabase env", {
      hasUrl: !!url,
      hasKey: !!key,
    });
    return null;
  }

  return createClient(url, key, {
    auth: { persistSession: false },
  });
}

function jsonError(
  status: number,
  error: string,
  extra?: Record<string, any>
) {
  return NextResponse.json({ ok: false, error, ...extra }, { status });
}

function getEmailNorm(req: NextRequest): string | null {
  const url = new URL(req.url);
  const qEmail = url.searchParams.get("email");
  if (qEmail && qEmail.trim()) {
    return qEmail.trim().toLowerCase();
  }

  const hdr = req.headers.get("x-spst-email");
  if (hdr && hdr.trim()) {
    return hdr.trim().toLowerCase();
  }

  return null;
}

function mapRowToMittente(row: any | null) {
  if (!row) return null;
  return {
    paese: row.mittente_paese ?? "",
    mittente: row.mittente_rs ?? "",
    citta: row.mittente_citta ?? "",
    cap: row.mittente_cap ?? "",
    indirizzo: row.mittente_indirizzo ?? "",
    telefono: row.mittente_telefono ?? "",
    piva: row.mittente_piva ?? "",
  };
}

// --- GET: leggi impostazioni -------------------------------------

export async function GET(req: NextRequest) {
  const emailNorm = getEmailNorm(req);
  if (!emailNorm) {
    console.warn("[API/impostazioni:GET] NO_EMAIL");
    return jsonError(401, "NO_EMAIL", {
      message: "Email mancante. Passa ?email= nella query string.",
    });
  }

  const supabase = makeSupabase();
  if (!supabase) {
    return jsonError(500, "MISSING_SUPABASE_ENV", {
      message:
        "Variabili Supabase mancanti (NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE).",
    });
  }

  try {
    const { data, error } = await supabase
      .from("shipper_defaults")
      .select(
        "email_norm, mittente_paese, mittente_rs, mittente_citta, mittente_cap, mittente_indirizzo, mittente_telefono, mittente_piva"
      )
      .eq("email_norm", emailNorm)
      .maybeSingle();

    if (error) {
      console.error("[API/impostazioni:GET] db error", error);
      return jsonError(500, "DB_ERROR", { message: error.message });
    }

    const mittente = mapRowToMittente(data);

    // body.shipper per la pagina React, mittente per chiarezza futura
    return NextResponse.json({
      ok: true,
      email: emailNorm,
      shipper: mittente,
      mittente,
    });
  } catch (err: any) {
    console.error("[API/impostazioni:GET] unexpected", err);
    return jsonError(500, "UNEXPECTED", { message: String(err?.message || err) });
  }
}

// --- POST: salva impostazioni -----------------------------------

export async function POST(req: NextRequest) {
  const emailNorm = getEmailNorm(req);
  if (!emailNorm) {
    console.warn("[API/impostazioni:POST] NO_EMAIL");
    return jsonError(401, "NO_EMAIL", {
      message: "Email mancante. Passa ?email= nella query string.",
    });
  }

  let body: any = {};
  try {
    body = (await req.json()) ?? {};
  } catch {
    // body vuoto = ok, gestiamo sotto
  }

  // Accetta sia { mittente: {...} } che il form piatto
  const m = body?.mittente ?? body ?? {};

  const payload = {
    email_norm: emailNorm,
    mittente_paese: (m.paese || "").trim() || null,
    mittente_rs: (m.mittente || "").trim() || null,
    mittente_citta: (m.citta || "").trim() || null,
    mittente_cap: (m.cap || "").trim() || null,
    mittente_indirizzo: (m.indirizzo || "").trim() || null,
    mittente_telefono: (m.telefono || "").trim() || null,
    mittente_piva: (m.piva || "").trim() || null,
  };

  const supabase = makeSupabase();
  if (!supabase) {
    return jsonError(500, "MISSING_SUPABASE_ENV", {
      message:
        "Variabili Supabase mancanti (NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE).",
    });
  }

  try {
    const { data, error } = await supabase
      .from("shipper_defaults")
      .upsert(payload, { onConflict: "email_norm" })
      .select(
        "email_norm, mittente_paese, mittente_rs, mittente_citta, mittente_cap, mittente_indirizzo, mittente_telefono, mittente_piva"
      )
      .maybeSingle();

    if (error) {
      console.error("[API/impostazioni:POST] db error", error);
      return jsonError(500, "DB_ERROR", { message: error.message });
    }

    const mittente = mapRowToMittente(data);

    return NextResponse.json({
      ok: true,
      email: emailNorm,
      shipper: mittente,
      mittente,
    });
  } catch (err: any) {
    console.error("[API/impostazioni:POST] unexpected", err);
    return jsonError(500, "UNEXPECTED", { message: String(err?.message || err) });
  }
}
