// app/api/utility-documenti/genera/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireStaff } from "@/lib/auth/requireStaff";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

function admin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing SUPABASE_URL/SERVICE_ROLE");
  return createClient(url, key, { auth: { persistSession: false } }) as any;
}

function jsonError(status: number, code: string, extra?: any) {
  return NextResponse.json(
    { ok: false, error: code, ...(extra ? { ...extra } : {}) },
    { status }
  );
}

type PackingListItem = {
  descrizione?: string | null;
  qta?: number | string | null;
  volume_l?: number | string | null;
  prezzo_unitario?: number | string | null;
};

function toNum(v: any): number {
  const n = typeof v === "string" ? Number(v.replace(",", ".")) : Number(v);
  return Number.isFinite(n) ? n : 0;
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

function normalizePackingList(input: any): PackingListItem[] {
  if (!Array.isArray(input)) return [];
  return input.map((x) => {
    const o = (x && typeof x === "object") ? x : {};
    return {
      descrizione:
        typeof o.descrizione === "string"
          ? o.descrizione
          : typeof o.nome === "string"
          ? o.nome
          : null,
      qta:
        o.qta ?? o.qty ?? o.quantita ?? o.quantity ?? null,
      volume_l:
        o.volume_l ?? o.volumeL ?? o.litri ?? o.liters ?? null,
      prezzo_unitario:
        o.prezzo_unitario ?? o.unitPrice ?? o.prezzo ?? o.price ?? null,
    };
  });
}

function buildCsv(rows: any[]): string {
  if (!Array.isArray(rows) || rows.length === 0) return "";
  const headers = Object.keys(rows[0] || {});
  const escape = (v: any) => {
    const s = v == null ? "" : String(v);
    const needs = /[",;\n\r]/.test(s);
    const out = s.replace(/"/g, '""');
    return needs ? `"${out}"` : out;
  };
  const lines = [
    headers.join(";"),
    ...rows.map((r) => headers.map((h) => escape((r as any)[h])).join(";")),
  ];
  return lines.join("\n");
}

export async function POST(req: Request) {
  const staff = await requireStaff();
  if ("response" in staff) return staff.response;

  try {
    const body = await req.json().catch(() => ({}));
    const shipmentId = body?.shipment_id || body?.shipmentId || body?.id;
    const format =
      (body?.format || body?.type || "JSON").toString().toUpperCase();

    if (!shipmentId || typeof shipmentId !== "string") {
      return jsonError(400, "VALIDATION_ERROR", {
        details: "shipment_id required",
      });
    }

    const supabase = admin();

    // Carichiamo una spedizione (con fields legacy, usati solo qui per packing list)
    const { data: shipment, error } = await supabase
      .schema("spst")
      .from("shipments")
      .select(
        [
          "id",
          "human_id",
          "created_at",
          "email_cliente",
          "tipo_spedizione",
          "incoterm",
          "declared_value",
          "fatt_valuta",
          "giorno_ritiro",
          "pickup_at",
          "note_ritiro",
          "formato_sped",
          "contenuto_generale",
          "mittente",
          "destinatario",
          "fatturazione",
          "colli_n",
          "peso_reale_kg",
          // attachments (colonne dedicate)
          "ldv",
          "fattura_proforma",
          "fattura_commerciale",
          "dle",
          "allegato1",
          "allegato2",
          "allegato3",
          "allegato4",
          // legacy extras
          "fields",
        ].join(",")
      )
      .eq("id", shipmentId)
      .single();

    if (error) {
      console.error("[API/utility-documenti/genera] DB_ERROR", error);
      if ((error as any).code === "PGRST116") {
        return jsonError(404, "NOT_FOUND");
      }
      return jsonError(500, "DB_ERROR", { details: error.message });
    }
    if (!shipment) return jsonError(404, "NOT_FOUND");

    const fields = (shipment as any).fields || {};

    // ============================
    // ⚠️ LEGACY: packing list da shipment.fields.packingList
    // ============================
    const packingJson = Array.isArray(fields.packingList)
      ? fields.packingList
      : Array.isArray(fields?.packing_list)
      ? fields.packing_list
      : Array.isArray(fields?.packinglist)
      ? fields.packinglist
      : null;

    const items = normalizePackingList(packingJson);

    // Calcoli
    const rows = items.map((it, idx) => {
      const qty = toNum(it.qta);
      const vol = toNum(it.volume_l);
      const unit = toNum(it.prezzo_unitario);
      const line = round2(qty * unit);

      return {
        n: idx + 1,
        descrizione: it.descrizione || "",
        qta: qty,
        volume_l: vol,
        prezzo_unitario: unit,
        line_total: line,
      };
    });

    const totalQty = rows.reduce((a, r) => a + toNum(r.qta), 0);
    const totalVolumeL = round2(rows.reduce((a, r) => a + toNum(r.volume_l), 0));
    const totalValue = round2(rows.reduce((a, r) => a + toNum(r.line_total), 0));

    const currency =
      (shipment as any).fatt_valuta ||
      (fields && (fields.currency || fields.valuta)) ||
      "EUR";

    const payload = {
      ok: true,
      shipment_id: (shipment as any).id,
      human_id: (shipment as any).human_id,
      created_at: (shipment as any).created_at,
      email_cliente: (shipment as any).email_cliente,
      tipo_spedizione: (shipment as any).tipo_spedizione,
      incoterm: (shipment as any).incoterm,
      declared_value: (shipment as any).declared_value,
      fatt_valuta: (shipment as any).fatt_valuta,
      giorno_ritiro: (shipment as any).giorno_ritiro,
      pickup_at: (shipment as any).pickup_at,
      note_ritiro: (shipment as any).note_ritiro,
      formato_sped: (shipment as any).formato_sped,
      contenuto_generale: (shipment as any).contenuto_generale,
      mittente: (shipment as any).mittente ?? null,
      destinatario: (shipment as any).destinatario ?? null,
      fatturazione: (shipment as any).fatturazione ?? null,
      colli_n: (shipment as any).colli_n ?? 0,
      peso_reale_kg: (shipment as any).peso_reale_kg ?? 0,
      attachments: {
        id: (shipment as any).id,
        ldv: (shipment as any).ldv ?? null,
        fattura_proforma: (shipment as any).fattura_proforma ?? null,
        fattura_commerciale: (shipment as any).fattura_commerciale ?? null,
        dle: (shipment as any).dle ?? null,
        allegato1: (shipment as any).allegato1 ?? null,
        allegato2: (shipment as any).allegato2 ?? null,
        allegato3: (shipment as any).allegato3 ?? null,
        allegato4: (shipment as any).allegato4 ?? null,
      },
      packing_list: rows,
      totals: {
        total_qty: totalQty,
        total_volume_l: totalVolumeL,
        total_value: totalValue,
        currency,
      },
    };

    if (format === "CSV") {
      const csv = buildCsv(rows);
      return new NextResponse(csv, {
        status: 200,
        headers: {
          "content-type": "text/csv; charset=utf-8",
          "content-disposition": `attachment; filename="packing-list-${(shipment as any).human_id || shipmentId}.csv"`,
        },
      });
    }

    return NextResponse.json(payload, { status: 200 });
  } catch (e: any) {
    console.error("[API/utility-documenti/genera] UNEXPECTED", e);
    return NextResponse.json(
      {
        ok: false,
        error: "UNEXPECTED",
        details: String(e?.message || e),
      },
      { status: 500 }
    );
  }
}
