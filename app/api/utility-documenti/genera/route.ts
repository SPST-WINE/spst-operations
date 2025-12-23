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

function toNum(v: any): number {
  const n = typeof v === "string" ? Number(v.replace(",", ".")) : Number(v);
  return Number.isFinite(n) ? n : 0;
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

function buildCsv(rows: Record<string, any>[]): string {
  if (!Array.isArray(rows) || rows.length === 0) return "";
  const headers = Object.keys(rows[0] || {});
  const escape = (v: any) => {
    const s = v == null ? "" : String(v);
    const needs = /[",;\n\r]/.test(s);
    const out = s.replace(/"/g, '""');
    return needs ? `"${out}"` : out;
  };
  return [
    headers.join(";"),
    ...rows.map((r) => headers.map((h) => escape((r as any)[h])).join(";")),
  ].join("\n");
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

    // ✅ Canonico: shipments (NO fields)
    const { data: shipment, error: shipErr } = await supabase
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
        ].join(",")
      )
      .eq("id", shipmentId)
      .single();

    if (shipErr) {
      if ((shipErr as any).code === "PGRST116") return jsonError(404, "NOT_FOUND");
      console.error("[utility-documenti/genera] shipment DB_ERROR", shipErr);
      return jsonError(500, "DB_ERROR", { details: shipErr.message });
    }
    if (!shipment) return jsonError(404, "NOT_FOUND");

    // ✅ Canonico: packages come source of truth per righe documento
    const { data: packages, error: pkgErr } = await supabase
      .schema("spst")
      .from("packages")
      .select("id,shipment_id,contenuto,peso_reale_kg,lato1_cm,lato2_cm,lato3_cm,created_at")
      .eq("shipment_id", shipmentId)
      .order("created_at", { ascending: true });

    if (pkgErr) {
      console.error("[utility-documenti/genera] packages DB_ERROR", pkgErr);
      return jsonError(500, "DB_ERROR", { details: pkgErr.message });
    }

    const pkgs = Array.isArray(packages) ? packages : [];

    // Packing list “freeze-compliant”:
    // - 1 riga per collo (packages)
    // - qta = 1 (non abbiamo linee prodotto canoniche nel DB)
    // - niente valori inventati
    const rows = pkgs.map((p: any, idx: number) => {
      const peso = toNum(p.peso_reale_kg);
      const l1 = toNum(p.lato1_cm);
      const l2 = toNum(p.lato2_cm);
      const l3 = toNum(p.lato3_cm);

      return {
        n: idx + 1,
        package_id: p.id,
        descrizione: p.contenuto || shipment.contenuto_generale || "Collo",
        qta: 1,
        peso_reale_kg: peso || 0,
        lato1_cm: l1 || 0,
        lato2_cm: l2 || 0,
        lato3_cm: l3 || 0,
      };
    });

    const totalPackages = rows.length;
    const totalWeightFromRows = round2(
      rows.reduce((a, r) => a + toNum(r.peso_reale_kg), 0)
    );

    // Preferiamo il totale “canonico” su shipments (trigger DB), ma senza fallback legacy.
    const shipmentPeso = toNum((shipment as any).peso_reale_kg);
    const totalWeightKg = shipmentPeso > 0 ? shipmentPeso : totalWeightFromRows;

    const currency = (shipment as any).fatt_valuta || "EUR";

    const payload = {
      ok: true,
      scope: "staff",
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
      colli_n: (shipment as any).colli_n ?? totalPackages,
      peso_reale_kg: (shipment as any).peso_reale_kg ?? totalWeightKg,

      // shape standard attachments (coerente con freeze)
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
        total_packages: totalPackages,
        total_weight_kg: totalWeightKg,
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
    console.error("[utility-documenti/genera] UNEXPECTED", e);
    return jsonError(500, "UNEXPECTED", { details: String(e?.message || e) });
  }
}

