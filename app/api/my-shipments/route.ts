// app/api/my-shipments/route.ts
import { NextResponse } from "next/server";

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

const URL = (process.env.NEXT_PUBLIC_SUPABASE_URL || "").trim();
const SR  = (process.env.SUPABASE_SERVICE_ROLE || "").trim();

function restUrl(path: string) {
  const base = URL.startsWith("http") ? URL : `https://${URL}`;
  return `${base.replace(/\/+$/,"")}/rest/v1/${path.replace(/^\/+/,"")}`;
}

export async function GET() {
  if (!URL || !SR) {
    return NextResponse.json(
      { ok: false, error: "UNEXPECTED_ERROR", details: "MISCONFIG: missing url or service role" },
      { status: 500 }
    );
  }

  // se hai esposto 'spst', puoi chiedere spst.shipments esplicitamente;
  // se hai creato le view public.shipments/public.packages, lascia 'shipments'
  const resource = "shipments"; // oppure "spst.shipments" se preferisci

  const url = new URL(restUrl(resource));
  url.searchParams.set("select",
    "id,human_id,tipo_spedizione,incoterm,mittente_citta,dest_citta,giorno_ritiro,colli_n,peso_reale_kg,created_at"
  );
  url.searchParams.set("order", "created_at.desc");
  url.searchParams.set("limit", "20");

  const r = await fetch(String(url), {
    headers: {
      apikey: SR,
      Authorization: `Bearer ${SR}`,
      "X-Client-Info": "spst-operations/my-shipments",
    },
    // utile in serverless se la tua rete è schizzinosa con i cert (tipicamente non serve)
    cache: "no-store",
  });

  const body = await r.json().catch(() => ({}));
  if (!r.ok) {
    return NextResponse.json(
      { ok: false, error: body?.code || "DB_SELECT_FAILED", details: body?.message || r.statusText },
      { status: 502 }
    );
  }

  return NextResponse.json({ ok: true, rows: (body as ShipmentRow[]) || [] });
}
