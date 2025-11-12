// app/api/my-shipments/route.ts
import { NextRequest, NextResponse } from "next/server";

type ShipmentRow = {
  id: string;
  human_id: string | null;
  tipo_spedizione: string | null;
  incoterm: string | null;
  mittente_citta: string | null;
  dest_citta: string | null;
  giorno_ritiro: string | null;
  colli_n: number | null;
  peso_reale_kg: string | number | null;
  created_at: string;
};

// ENV
const RAW_URL = (process.env.NEXT_PUBLIC_SUPABASE_URL || "").trim();
const SR = (process.env.SUPABASE_SERVICE_ROLE || "").trim();

// Nome risorsa REST esposta da PostgREST.
// Se hai esposto lo schema `spst`, puoi anche usare "spst.shipments" qui.
// Se invece hai creato una view "public.shipments", lascia "shipments".
const REST_RESOURCE = process.env.SUPABASE_REST_RESOURCE || "shipments";

/** Normalizza la base URL (accetta anche solo dominio nudo) */
function baseUrl() {
  if (!RAW_URL) return "";
  return RAW_URL.startsWith("http") ? RAW_URL.replace(/\/+$/, "") : `https://${RAW_URL.replace(/\/+$/, "")}`;
}

function restUrl(path: string) {
  const b = baseUrl();
  return `${b}/rest/v1/${path.replace(/^\/+/, "")}`;
}

export async function GET(req: NextRequest) {
  const debug = req.nextUrl.searchParams.get("debug") === "1";

  // Check ENV
  if (!RAW_URL || !SR) {
    const details = {
      NEXT_PUBLIC_SUPABASE_URL: RAW_URL || "(missing)",
      SUPABASE_SERVICE_ROLE: SR ? "present" : "(missing)",
    };
    if (debug) console.error("[API/my-shipments] MISCONFIG", details);
    return NextResponse.json(
      { ok: false, error: "UNEXPECTED_ERROR", details: "MISCONFIG: missing url or service role", env: details },
      { status: 500 }
    );
  }

  // Costruzione query REST
  const url = new URL(restUrl(REST_RESOURCE));
  url.searchParams.set(
    "select",
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
    ].join(",")
  );
  url.searchParams.set("order", "created_at.desc");
  url.searchParams.set("limit", "20");

  if (debug) {
    console.log("[API/my-shipments] ENV summary:", {
      NEXT_PUBLIC_SUPABASE_URL: RAW_URL,
      SUPABASE_SERVICE_ROLE: SR ? "present" : "missing",
      REST_RESOURCE,
    });
    console.log("[API/my-shipments] REST URL:", String(url));
  }

  try {
    const r = await fetch(String(url), {
      method: "GET",
      headers: {
        apikey: SR,
        Authorization: `Bearer ${SR}`,
        "X-Client-Info": "spst-operations/my-shipments",
      },
      cache: "no-store",
    });

    const body = await r.json().catch(() => ({}));

    if (!r.ok) {
      if (debug) {
        console.error("[API/my-shipments] REST error:", {
          status: r.status,
          statusText: r.statusText,
          body,
        });
      }
      // PostgREST schema cache error tipico quando lo schema/oggetto non è esposto
      const code = body?.code || "DB_SELECT_FAILED";
      const msg =
        body?.message ||
        (r.status === 503 ? "Service Unavailable" : r.statusText || "DB select failed");
      return NextResponse.json(
        { ok: false, error: code, details: msg },
        { status: 502 }
      );
    }

    const rows = (Array.isArray(body) ? (body as ShipmentRow[]) : []) ?? [];
    return NextResponse.json({ ok: true, rows });
  } catch (err: any) {
    if (debug) console.error("[API/my-shipments] unexpected error:", err);
    // Niente fallback pg: manteniamo il percorso REST pulito
    return NextResponse.json(
      { ok: false, error: "UNEXPECTED_ERROR", details: String(err?.message || err) },
      { status: 500 }
    );
  }
}
