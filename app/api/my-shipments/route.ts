import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

type Row = {
  id: string;
  human_id: string | null;
  tipo_spedizione: string | null;
  incoterm: string | null;
  mittente_citta: string | null;
  dest_citta: string | null;
  giorno_ritiro: string | null; // string perché in view usiamo to_char
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

function admin() {
  const url = envOrThrow("NEXT_PUBLIC_SUPABASE_URL");
  const key = envOrThrow("SUPABASE_SERVICE_ROLE");
  return createClient(url, key, {
    db: { schema: "api" }, // IMPORTANTISSIMO: lavoriamo sullo schema api
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { "X-Client-Info": "spst-operations/my-shipments" } },
  });
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(req: Request) {
  const url = new URL(req.url);
  const debug = url.searchParams.get("debug") === "1";
  const emailParam = (url.searchParams.get("email") || "").trim().toLowerCase();

  const supa = admin();

  try {
    if (debug) {
      console.warn("[API/my-shipments] ENV summary:", {
        NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/^https?:\/\//, ""),
        HAS_SERVICE_ROLE: !!process.env.SUPABASE_SERVICE_ROLE,
      });
    }

    let q = supa
      .from("my_shipments")
      .select<Row>("id,human_id,tipo_spedizione,incoterm,mittente_citta,dest_citta,giorno_ritiro,colli_n,peso_reale_kg,created_at,email_cliente,email_norm")
      .order("created_at", { ascending: false })
      .limit(20);

    if (emailParam) {
      q = q.ilike("email_norm", `%${emailParam}%`);
    }

    const { data, error } = await q;

    if (error) {
      console.error("[API/my-shipments] select error:", error);
      return NextResponse.json(
        { ok: false, error: error.code || "DB_SELECT_FAILED", details: error.message },
        { status: 502 }
      );
    }

    if (debug) {
      console.log("[API/my-shipments] rows:", Array.isArray(data) ? data.length : "null");
      if ((data?.length || 0) > 0) {
        console.log("[API/my-shipments] sample:", data?.[0]);
      }
    }

    // Fallback diagnostico: se 0 righe, prova la REST diretta (stessa view, stesso schema)
    if ((!data || data.length === 0) && debug) {
      try {
        const restUrl = `${envOrThrow("NEXT_PUBLIC_SUPABASE_URL").replace(/\/+$/, "")}/rest/v1/my_shipments?select=id,human_id,created_at&order=created_at.desc&limit=3`;
        const r = await fetch(restUrl, {
          headers: {
            apikey: envOrThrow("SUPABASE_SERVICE_ROLE"),
            "Accept-Profile": "api",
          },
        });
        const body = await r.json().catch(() => ({}));
        console.warn("[API/my-shipments] REST fallback status:", r.status, r.statusText, "body:", body);
      } catch (e: any) {
        console.error("[API/my-shipments] REST fallback error:", e?.message || e);
      }
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
