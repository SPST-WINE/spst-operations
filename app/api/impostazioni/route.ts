// app/api/impostazioni/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

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

/* ---------------------- GET: leggi impostazioni ---------------------- */
export async function GET(req: NextRequest) {
  const emailNorm = getEmailNorm(req);
  if (!emailNorm) {
    console.warn("[API/impostazioni:GET] NO_EMAIL");
    return jsonError(401, "NO_EMAIL", {
      message: "Email mancante. Passa ?email= nella query string.",
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

    return NextResponse.json({
      ok: true,
      email: emailNorm,
      mittente: mapRowToMittente(data),
    });
  } catch (err: any) {
    console.error("[API/impostazioni:GET] unexpected", err);
    return jsonError(500, "UNEXPECTED", { message: String(err?.message || err) });
  }
}

/* ---------------------- POST: salva impostazioni ---------------------- */
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
    // ignore, body vuoto
  }

  const m = body?.mittente ?? {};

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

    return NextResponse.json({
      ok: true,
      email: emailNorm,
      mittente: mapRowToMittente(data),
    });
  } catch (err: any) {
    console.error("[API/impostazioni:POST] unexpected", err);
    return jsonError(500, "UNEXPECTED", { message: String(err?.message || err) });
  }
}
