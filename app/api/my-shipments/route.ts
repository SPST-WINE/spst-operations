import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/** Tipi minimi della view */
type MyShipment = {
  id: string;
  human_id: string | null;
  tipo_spedizione: string | null;
  incoterm: string | null;
  mittente_citta: string | null;
  dest_citta: string | null;
  giorno_ritiro: string | null;
  colli_n: number | null;
  peso_reale_kg: number | null;
  created_at: string;
  email_cliente: string | null;
  email_norm: string | null;
};

function envOrThrow(name: string): string {
  const v = process.env[name];
  if (!v || v.trim() === "") throw new Error(`Missing env ${name}`);
  return v;
}

function adminClient() {
  const url = envOrThrow("NEXT_PUBLIC_SUPABASE_URL");
  const key = envOrThrow("SUPABASE_SERVICE_ROLE");
  // forza schema 'api' perché la view è lì
  return createClient(url, key, {
    db: { schema: "api" },
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { "X-Client-Info": "spst-operations/my-shipments" } },
  });
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(req: Request) {
  const supa = adminClient();

  // email dall’utente loggato oppure da query (?email=…)
  const url = new URL(req.url);
  const email =
    (url.searchParams.get("email") || "").trim().toLowerCase();

  try {
    let q = supa
      .from<"my_shipments", MyShipment>("my_shipments")
      .select(
        "id,human_id,tipo_spedizione,incoterm,mittente_citta,dest_citta,giorno_ritiro,colli_n,peso_reale_kg,created_at,email_cliente,email_norm"
      )
      .order("created_at", { ascending: false })
      .limit(20);

    if (email) {
      q = q.ilike("email_norm", `%${email}%`);
    }

    const { data, error } = await q;
    if (error) {
      console.error("[API/my-shipments] select error:", error);
      return NextResponse.json(
        { ok: false, error: error.code || "DB_SELECT_FAILED", details: error.message },
        { status: 502 }
      );
    }

    return NextResponse.json({ ok: true, rows: data ?? [] });
  } catch (e: any) {
    console.error("[API/my-shipments] unexpected:", e);
    return NextResponse.json(
      { ok: false, error: "UNEXPECTED_ERROR", details: String(e?.message || e) },
      { status: 500 }
    );
  }
}
