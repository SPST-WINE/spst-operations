// app/api/utility-documenti/genera/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { DocData, DocItem, DocParty } from "@/lib/docs/render/types";
import { renderDocumentHtml } from "@/lib/docs/render";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function envOrThrow(name: string): string {
  const v = process.env[name];
  if (!v || v.trim() === "") {
    throw new Error(`Missing env ${name}`);
  }
  return v;
}

function admin() {
  const url = envOrThrow("NEXT_PUBLIC_SUPABASE_URL");
  const key =
    process.env.SUPABASE_SERVICE_ROLE ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    envOrThrow("SUPABASE_SERVICE_ROLE");
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  }) as any;
}

const ALLOWED_DOC_TYPES = new Set([
  "ddt",
  "fattura_proforma",
  "fattura_commerciale",
  "dle",
]);

// ----------------------- Tipi interni -----------------------
type ShipmentRow = {
  id: string;
  human_id?: string | null;
  carrier?: string | null;
  tracking_code?: string | null;
  incoterm?: string | null;
  incoterm_norm?: string | null;
  colli_n?: number | null;
  peso_reale_kg?: number | null;
  contenuto_generale?: string | null;
  giorno_ritiro?: string | null;
  fatt_valuta?: string | null;

  mittente_rs?: string | null;
  mittente_referente?: string | null;
  mittente_indirizzo?: string | null;
  mittente_cap?: string | null;
  mittente_citta?: string | null;
  mittente_paese?: string | null;
  mittente_piva?: string | null;
  mittente_telefono?: string | null;

  dest_rs?: string | null;
  dest_referente?: string | null;
  dest_indirizzo?: string | null;
  dest_cap?: string | null;
  dest_citta?: string | null;
  dest_paese?: string | null;
  dest_piva?: string | null;
  dest_telefono?: string | null;

  fatt_rs?: string | null;
  fatt_referente?: string | null;
  fatt_indirizzo?: string | null;
  fatt_cap?: string | null;
  fatt_citta?: string | null;
  fatt_paese?: string | null;
  fatt_piva?: string | null;
  fatt_telefono?: string | null;

  fields?: any;
  [key: string]: any;
};

type PackingLineDb = {
  id: string;
  label?: string | null;
  item_type?: string | null;
  bottles?: number | null;
  volume_l?: number | null;
  unit_price?: number | null;
  currency?: string | null;

  // 🔹 gradazione dalla tabella shipment_pl_lines
  abv_percent?: number | null;

  [key: string]: any;
};

// ----------------- Normalizzazione packing list -----------------
function mapPackingJsonToItems(shipment: ShipmentRow): DocItem[] {
  const fields = (shipment.fields || {}) as any;
  const packingJson = Array.isArray(fields.packingList)
    ? (fields.packingList as any[])
    : [];

  return packingJson.map((row): DocItem => {
    const bottles: number | null =
      row.bottiglie ?? row.qty ?? row.quantita ?? null;

    const volPerBottle: number | null =
      row.formato_litri ?? row.volume_litri ?? null;

    const totalVolumeL: number | null =
      bottles != null && volPerBottle != null ? bottles * volPerBottle : null;

    const unitPrice: number | null = row.prezzo ?? row.unit_price ?? null;

    const currency: string | null =
      row.valuta ??
      row.currency ??
      shipment.fatt_valuta ??
      fields.valuta ??
      null;

    const lineTotal: number | null =
      bottles != null && unitPrice != null ? bottles * unitPrice : null;

    const descriptionParts = [row.etichetta, row.tipologia]
      .filter((x) => !!x && String(x).trim().length > 0)
      .map((x) => String(x).trim());

    const description =
      descriptionParts.length > 0 ? descriptionParts.join(" – ") : "Wine";

    const alcoholPercent: number | null =
      row.abv_percent ??
      row.abv ??
      row.alcohol ??
      row.gradazione ??
      null;

    return {
      description,
      bottles,
      volumePerBottleL: volPerBottle,
      totalVolumeL,
      unitPrice,
      currency,
      lineTotal,
      itemType: row.tipologia ?? null,
      alcoholPercent,
    };
  });
}

function mapPackingDbToItems(lines: PackingLineDb[]): DocItem[] {
  return (lines || []).map((row): DocItem => {
    const bottles = row.bottles ?? null;
    const volPerBottle: number | null = null;
    const totalVolumeL: number | null = row.volume_l ?? null;
    const unitPrice = row.unit_price ?? null;
    const currency = row.currency ?? null;
    const lineTotal: number | null =
      bottles != null && unitPrice != null ? bottles * unitPrice : null;

    const alcoholPercent: number | null =
      typeof row.abv_percent === "number" ? Number(row.abv_percent) : null;

    return {
      description: row.label || "Voce packing list",
      bottles,
      volumePerBottleL: volPerBottle,
      totalVolumeL,
      unitPrice,
      currency,
      lineTotal,
      itemType: row.item_type ?? null,
      alcoholPercent,
    };
  });
}

// ----------------- Costruzione DocData normalizzato -----------------
function buildDocData(
  docType: string,
  courier: string,
  trackingCode: string | null,
  shipment: ShipmentRow,
  plLines: PackingLineDb[]
): DocData {
  const fields = (shipment.fields || {}) as any;
  const mittJson = (fields.mittente || {}) as any;
  const destJson = (fields.destinatario || {}) as any;
  const fattJson = (fields.fatturazione || {}) as any;

  const itemsFromJson = mapPackingJsonToItems(shipment);
  const itemsFromDb = mapPackingDbToItems(plLines);

  const items: DocItem[] =
    itemsFromDb && itemsFromDb.length > 0 ? itemsFromDb : itemsFromJson;

  const totalBottles = items.reduce((sum, it) => sum + (it.bottles ?? 0), 0);

  const totalVolumeL =
    items.some((it) => it.totalVolumeL != null)
      ? items.reduce((sum, it) => sum + (it.totalVolumeL ?? 0), 0)
      : null;

  const totalValue =
    items.some((it) => it.lineTotal != null)
      ? items.reduce((sum, it) => sum + (it.lineTotal ?? 0), 0)
      : null;

  const currency =
    items.find((it) => !!it.currency)?.currency ??
    shipment.fatt_valuta ??
    fields.valuta ??
    null;

  const today = new Date();
  const docDate = today.toISOString().slice(0, 10);
  const humanId = shipment.human_id ?? null;

  // Sigla documento SPST-...
  let typeLabel = "";
  switch (docType) {
    case "ddt":
      typeLabel = "SPST-DDT";
      break;
    case "fattura_proforma":
      typeLabel = "SPST-PROFORMA";
      break;
    case "fattura_commerciale":
      typeLabel = "SPST-FATTURA";
      break;
    case "dle":
      typeLabel = "SPST-DLE";
      break;
    default:
      typeLabel = "SPST-DOC";
  }

  const meta: DocData["meta"] = {
    docType,
    docNumber: `${typeLabel}-${humanId ?? shipment.id}`,
    docDate,
    humanId,
    courier,
    trackingCode,
    incoterm: shipment.incoterm_norm ?? shipment.incoterm ?? null,
    valuta: currency,
  };

  const shipper: DocParty = {
    name: shipment.mittente_rs ?? mittJson.ragioneSociale ?? null,
    contact: shipment.mittente_referente ?? mittJson.referente ?? null,
    address: {
      line1: shipment.mittente_indirizzo ?? mittJson.indirizzo ?? null,
      city: shipment.mittente_citta ?? mittJson.citta ?? null,
      postalCode: shipment.mittente_cap ?? mittJson.cap ?? null,
      country: shipment.mittente_paese ?? mittJson.paese ?? null,
    },
    vatNumber: shipment.mittente_piva ?? mittJson.piva ?? null,
    phone: shipment.mittente_telefono ?? mittJson.telefono ?? null,
  };

  const consignee: DocParty = {
    name: shipment.dest_rs ?? destJson.ragioneSociale ?? null,
    contact: shipment.dest_referente ?? destJson.referente ?? null,
    address: {
      line1: shipment.dest_indirizzo ?? destJson.indirizzo ?? null,
      city: shipment.dest_citta ?? destJson.citta ?? null,
      postalCode: shipment.dest_cap ?? destJson.cap ?? null,
      country: shipment.dest_paese ?? destJson.paese ?? null,
    },
    vatNumber: shipment.dest_piva ?? destJson.piva ?? null,
    phone: shipment.dest_telefono ?? destJson.telefono ?? null,
  };

  const hasBillToColumns =
    shipment.fatt_rs ||
    shipment.fatt_indirizzo ||
    shipment.fatt_paese ||
    shipment.fatt_piva;

  const billTo: DocParty =
    hasBillToColumns || Object.keys(fattJson).length > 0
      ? {
          name: shipment.fatt_rs ?? fattJson.ragioneSociale ?? null,
          contact: shipment.fatt_referente ?? fattJson.referente ?? null,
          address: {
            line1: shipment.fatt_indirizzo ?? fattJson.indirizzo ?? null,
            city: shipment.fatt_citta ?? fattJson.citta ?? null,
            postalCode: shipment.fatt_cap ?? fattJson.cap ?? null,
            country: shipment.fatt_paese ?? fattJson.paese ?? null,
          },
          vatNumber: shipment.fatt_piva ?? fattJson.piva ?? null,
          phone: shipment.fatt_telefono ?? fattJson.telefono ?? null,
        }
      : consignee;

  const shipmentInfo: DocData["shipment"] = {
    totalPackages: shipment.colli_n ?? null,
    totalGrossWeightKg:
      typeof shipment.peso_reale_kg === "number"
        ? shipment.peso_reale_kg
        : null,
    contentSummary:
      shipment.contenuto_generale ??
      fields.contenuto ??
      fields.contenuto_generale ??
      "Wine bottles",
    pickupDate:
      shipment.giorno_ritiro ??
      (fields.ritiroData ? String(fields.ritiroData).slice(0, 10) : null),
  };

  const totals: DocData["totals"] = {
    totalBottles,
    totalVolumeL,
    totalValue,
    currency,
  };

  return {
    meta,
    parties: {
      shipper,
      consignee,
      billTo,
    },
    shipment: shipmentInfo,
    items,
    totals,
  };
}

// ----------------- Handler POST -----------------
export async function POST(req: Request) {
  let body: any = {};
  try {
    body = await req.json();
  } catch {}

  const rawDocType = (body?.doc_type || "").trim();
  const docDataFromBody = body?.doc_data as DocData | undefined;

  // Se ci arriva già un doc_data: modalità "render-only", niente DB
  if (docDataFromBody) {
    const inferredType =
      rawDocType || docDataFromBody.meta?.docType || "fattura_proforma";

    if (!ALLOWED_DOC_TYPES.has(inferredType)) {
      return NextResponse.json(
        { ok: false, error: "INVALID_DOC_TYPE" },
        { status: 400 }
      );
    }

    const normalizedDoc: DocData = {
      ...docDataFromBody,
      meta: {
        ...docDataFromBody.meta,
        docType: inferredType,
      },
    };

    const html = renderDocumentHtml(normalizedDoc);

    return NextResponse.json({
      ok: true,
      doc: normalizedDoc,
      html,
    });
  }

  // Modalità classica: da human_id
  const humanId = (body?.human_id || "").trim();
  const docType = rawDocType;

  if (!humanId) {
    return NextResponse.json(
      { ok: false, error: "MISSING_HUMAN_ID" },
      { status: 400 }
    );
  }
  if (!ALLOWED_DOC_TYPES.has(docType)) {
    return NextResponse.json(
      { ok: false, error: "INVALID_DOC_TYPE" },
      { status: 400 }
    );
  }

  const courier = (body?.courier || "").trim();
  const trackingCode = (body?.tracking_code || "").trim() || null;

  if (!courier) {
    return NextResponse.json(
      { ok: false, error: "MISSING_COURIER" },
      { status: 400 }
    );
  }

  try {
    const supa = admin();

    const {
      data: shipment,
      error: shipmentErr,
    } = await supa
      .schema("spst")
      .from("shipments")
      .select("*")
      .eq("human_id", humanId)
      .single();

    if (shipmentErr || !shipment) {
      console.error(
        "[utility-documenti:genera] shipment select error:",
        shipmentErr?.message
      );
      return NextResponse.json(
        { ok: false, error: "SHIPMENT_NOT_FOUND" },
        { status: 404 }
      );
    }

    const shipmentId = shipment.id as string;

    const { data: plLines, error: plErr } = await supa
      .schema("spst")
      .from("shipment_pl_lines")
      .select("*")
      .eq("shipment_id", shipmentId);

    if (plErr) {
      console.error(
        "[utility-documenti:genera] pl_lines select error:",
        plErr
      );
    }

    const docData = buildDocData(
      docType,
      courier,
      trackingCode,
      shipment as ShipmentRow,
      (plLines || []) as PackingLineDb[]
    );

    const html = renderDocumentHtml(docData);

    return NextResponse.json({
      ok: true,
      doc: docData,
      html,
      raw: {
        shipment,
        packingListDb: plLines || [],
      },
    });
  } catch (e: any) {
    console.error("[utility-documenti:genera] unexpected error:", e);
    return NextResponse.json(
      {
        ok: false,
        error: "UNEXPECTED_ERROR",
        details: String(e?.message || e),
      },
      { status: 500 }
    );
  }
}
