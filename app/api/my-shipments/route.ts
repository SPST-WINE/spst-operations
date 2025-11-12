// app/api/my-shipments/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

type Row = {
  id: string;
  human_id: string | null;
  tipo_spedizione: string | null;
  incoterm: string | null;
  mittente_citta: string | null;
  dest_citta: string | null;
  giorno_ritiro: string | null;   // date
  colli_n: number | null;
  peso_reale_kg: string | number | null;
  created_at: string;             // timestamptz
  email_cliente: string | null;
};

function envSummary() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const sr = process.env.SUPABASE_SERVICE_ROLE || "";
  return {
    NEXT_PUBLIC_SUPABASE_URL: url.replace(/^https?:\/\//, ""),
    SUPABASE_SERVICE_ROLE: sr ? `${sr.slice(0, 3)}…${sr.slice(-3)}` : "",
  };
}

function getEmail(req: Request) {
  const u = new URL(req.url);
  const qEmail = u.searchParams.get("email");
  const hEmail = req.headers.get("x-user-email");
  const email = (hEmail || qEmail || "").trim();
  return email;
}

function getAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE;
  if (!url || !key) {
    throw new Error("SUPABASE_ADMIN_MISCONFIG");
  }
  // client admin; schema API per leggere la view api.my_shipments
  return createClient(url, key, {
    db: { schema: "api" },
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { "X-Client-Info": "spst-operations/my-shipments" } },
  });
}

export async function GET(req: Request) {
  try {
    // log "soft" per debug
    console.warn("[API/my-shipments] ENV:", envSummary());
  } catch {}

  // 1) prendo email
  const email = getEmail(req);

  // 2) se manca, ritorno array vuoto (UI mostra “nessuna spedizione”)
  if (!email) {
    return NextResponse.json({ ok: true, rows: [] });
  }

  // 3) query via service-role sulla VIEW api.my_shipments (schema api)
  try {
    const supa = getAdmin();

    const { data, error, status, statusText } = await supa
      .from<"my_shipments", Row>("my_shipments")
      .select(
        [
          "id",
          "human_id",
          "tipo_spedizione",
          "incoterm",
          "mittente_citta",
          "dest_citta",
          "giorno_ritiro",
          "colli_n",
          "peso_reale_kg",
          "created_at",
          "email_cliente",
        ].join(",")
      )
      .ilike("email_cliente", email) // match case-insensitive
      .order("created_at", { ascending: false })
      .limit(20);

    if (error) {
      console.error("[API/my-shipments] supabase error:", {
        code: (error as any).code,
        message: error.message,
        status,
        statusText,
      });
      return NextResponse.json(
        { ok: false, error: "DB_SELECT_FAILED", details: error.message },
        { status: 502 }
      );
    }

    return NextResponse.json({ ok: true, rows: data ?? [] });
  } catch (e: any) {
    console.error("[API/my-shipments] unexpected:", e?.message || e);
    if (e?.message === "SUPABASE_ADMIN_MISCONFIG") {
      return NextResponse.json(
        { ok: false, error: "SUPABASE_ADMIN_MISCONFIG", details: "missing url or service role" },
        { status: 500 }
      );
    }
    return NextResponse.json(
      { ok: false, error: "UNEXPECTED_ERROR", details: String(e?.message || e) },
      { status: 500 }
    );
  }
}
