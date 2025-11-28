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
  [key: string]: any;
};

type DocItem = {
  description: string;
  bottles: number | null;
  volumePerBottleL: number | null;
  totalVolumeL: number | null;
  unitPrice: number | null;
  currency: string | null;
  lineTotal: number | null;
  itemType: string | null;
};

type DocParty = {
  name: string | null;
  contact: string | null;
  address: {
    line1: string | null;
    city: string | null;
    postalCode: string | null;
    country: string | null;
  };
  vatNumber: string | null;
  phone: string | null;
};

type DocData = {
  meta: {
    docType: string;
    docNumber: string;
    docDate: string;
    humanId: string | null | undefined;
    courier: string;
    trackingCode: string | null;
    incoterm: string | null;
    valuta: string | null;
  };
  parties: {
    shipper: DocParty;
    consignee: DocParty;
    billTo: DocParty;
  };
  shipment: {
    totalPackages: number | null;
    totalGrossWeightKg: number | null;
    contentSummary: string | null;
    pickupDate: string | null;
  };
  items: DocItem[];
  totals: {
    totalBottles: number;
    totalVolumeL: number | null;
    totalValue: number | null;
    currency: string | null;
  };
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
      descriptionParts.length > 0
        ? descriptionParts.join(" – ")
        : "Wine";

    return {
      description,
      bottles,
      volumePerBottleL: volPerBottle,
      totalVolumeL,
      unitPrice,
      currency,
      lineTotal,
      itemType: row.tipologia ?? null,
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

    return {
      description: row.label || "Voce packing list",
      bottles,
      volumePerBottleL: volPerBottle,
      totalVolumeL,
      unitPrice,
      currency,
      lineTotal,
      itemType: row.item_type ?? null,
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

  const totalBottles = items.reduce(
    (sum, it) => sum + (it.bottles ?? 0),
    0
  );

  const totalVolumeL =
    items.some((it) => it.totalVolumeL != null)
      ? items.reduce(
          (sum, it) => sum + (it.totalVolumeL ?? 0),
          0
        )
      : null;

  const totalValue =
    items.some((it) => it.lineTotal != null)
      ? items.reduce(
          (sum, it) => sum + (it.lineTotal ?? 0),
          0
        )
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

// ----------------- Rendering HTML (PROFORMA + placeholder) -----------------

function esc(v: any): string {
  if (v === null || v === undefined) return "";
  return String(v)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function renderAddressBlock(party: DocParty): string {
  const lines: string[] = [];
  if (party.name) lines.push(esc(party.name));
  if (party.address.line1) lines.push(esc(party.address.line1));
  const cityLine = [party.address.postalCode, party.address.city]
    .filter(Boolean)
    .join(" ");
  if (cityLine) lines.push(esc(cityLine));
  if (party.address.country) lines.push(esc(party.address.country));
  if (party.vatNumber) lines.push("VAT / Tax ID: " + esc(party.vatNumber));
  if (party.phone) lines.push("Tel: " + esc(party.phone));
  if (party.contact) lines.push("Attn: " + esc(party.contact));
  return lines.join("<br />");
}

function renderProformaHtml(doc: DocData): string {
  const { meta, parties, shipment, items, totals } = doc;

  const incotermStr = meta.incoterm ? esc(meta.incoterm) : "";
  const courierStr = meta.courier ? esc(meta.courier) : "";
  const trackingStr = meta.trackingCode ? esc(meta.trackingCode) : "";

  const rowsHtml =
    items.length === 0
      ? `<tr>
           <td colspan="7" style="padding:8px 6px;font-size:11px;color:#555;">
             No items
           </td>
         </tr>`
      : items
          .map((it, idx) => {
            return `
          <tr>
            <td style="padding:6px;border-bottom:1px solid #e5e7eb;font-size:11px;">${idx + 1}</td>
            <td style="padding:6px;border-bottom:1px solid #e5e7eb;font-size:11px;">${esc(
              it.description
            )}</td>
            <td style="padding:6px;border-bottom:1px solid #e5e7eb;text-align:right;font-size:11px;">${
              it.bottles ?? ""
            }</td>
            <td style="padding:6px;border-bottom:1px solid #e5e7eb;text-align:right;font-size:11px;">${
              it.volumePerBottleL != null ? it.volumePerBottleL.toFixed(2) : ""
            }</td>
            <td style="padding:6px;border-bottom:1px solid #e5e7eb;text-align:right;font-size:11px;">${
              it.totalVolumeL != null ? it.totalVolumeL.toFixed(2) : ""
            }</td>
            <td style="padding:6px;border-bottom:1px solid #e5e7eb;text-align:right;font-size:11px;">${
              it.unitPrice != null ? it.unitPrice.toFixed(2) : ""
            }</td>
            <td style="padding:6px;border-bottom:1px solid #e5e7eb;text-align:right;font-size:11px;">${
              it.lineTotal != null ? it.lineTotal.toFixed(2) : ""
            }</td>
          </tr>`;
          })
          .join("");

  const totalVolumeStr =
    totals.totalVolumeL != null ? totals.totalVolumeL.toFixed(2) : "";
  const totalValueStr =
    totals.totalValue != null ? totals.totalValue.toFixed(2) : "";
  const currency = esc(totals.currency ?? meta.valuta ?? "");

  const destinationCountry =
    parties.consignee.address.country ||
    parties.consignee.address.city ||
    "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Proforma Invoice - ${esc(meta.docNumber)}</title>
  <style>
    * {
      box-sizing: border-box;
    }
    body {
      margin: 0;
      padding: 0;
      font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      font-size: 12px;
      color: #0f172a;
    }
    .page {
      width: 210mm;
      min-height: 297mm;
      padding: 18mm 18mm 20mm 18mm;
      margin: 0 auto;
      background: #ffffff;
    }
    h1, h2, h3, h4 {
      margin: 0;
      font-weight: 600;
      color: #0f172a;
    }
    .section-title {
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: #6b7280;
      margin-bottom: 4px;
    }
    table {
      border-collapse: collapse;
      width: 100%;
    }
  </style>
</head>
<body>
  <div class="page">
    <!-- Header -->
    <table style="width:100%; margin-bottom:16px;">
      <tr>
        <td style="vertical-align:top;">
          <div style="font-size:18px; font-weight:700; letter-spacing:0.08em;">SPST</div>
          <div style="font-size:11px; color:#6b7280; margin-top:2px;">Specialized Wine Logistics</div>
        </td>
        <td style="text-align:right; vertical-align:top;">
          <div style="font-size:16px; font-weight:700;">PROFORMA INVOICE</div>
          <div style="margin-top:4px; font-size:11px; color:#4b5563;">
            No. <strong>${esc(meta.docNumber)}</strong><br/>
            Date: <strong>${esc(meta.docDate)}</strong><br/>
            Shipment ID: <strong>${esc(meta.humanId || "")}</strong>
          </div>
          <div style="margin-top:6px; font-size:11px; color:#4b5563;">
            Courier: <strong>${courierStr || "-"}</strong><br/>
            Tracking: <strong>${trackingStr || "-"}</strong><br/>
            Incoterm: <strong>${incotermStr || "-"}</strong>
          </div>
        </td>
      </tr>
    </table>

    <!-- Parties -->
    <table style="width:100%; margin-bottom:16px;">
      <tr>
        <td style="width:33%; vertical-align:top; padding-right:8px;">
          <div class="section-title">Seller</div>
          <div style="font-size:11px; line-height:1.4;">
            ${renderAddressBlock(parties.shipper)}
          </div>
        </td>
        <td style="width:33%; vertical-align:top; padding-right:8px;">
          <div class="section-title">Buyer / Consignee</div>
          <div style="font-size:11px; line-height:1.4;">
            ${renderAddressBlock(parties.consignee)}
          </div>
        </td>
        <td style="width:34%; vertical-align:top;">
          <div class="section-title">Bill to</div>
          <div style="font-size:11px; line-height:1.4;">
            ${renderAddressBlock(parties.billTo)}
          </div>
        </td>
      </tr>
    </table>

    <!-- Shipment info -->
    <table style="width:100%; margin-bottom:12px; font-size:11px;">
      <tr>
        <td style="width:50%; vertical-align:top; padding-right:8px;">
          <div class="section-title">Shipment details</div>
          <div style="line-height:1.5;">
            Country of origin: <strong>Italy</strong><br/>
            Destination: <strong>${esc(destinationCountry)}</strong><br/>
            Total packages: <strong>${shipment.totalPackages ?? "-"}</strong><br/>
            Gross weight: <strong>${
              shipment.totalGrossWeightKg != null
                ? shipment.totalGrossWeightKg + " kg"
                : "-"
            }</strong><br/>
            Pickup date: <strong>${
              shipment.pickupDate ? esc(String(shipment.pickupDate)) : "-"
            }</strong><br/>
          </div>
        </td>
        <td style="width:50%; vertical-align:top;">
          <div class="section-title">Goods</div>
          <div style="line-height:1.5;">
            Description: <strong>${
              shipment.contentSummary
                ? esc(shipment.contentSummary)
                : "Wine bottles"
            }</strong><br/>
            HS code: <strong>2204.21</strong><br/>
            Total bottles: <strong>${totals.totalBottles}</strong><br/>
            Total volume: <strong>${
              totalVolumeStr ? totalVolumeStr + " L" : "-"
            }</strong><br/>
          </div>
        </td>
      </tr>
    </table>

    <!-- Items table -->
    <div class="section-title" style="margin-bottom:4px;">Items</div>
    <table>
      <thead>
        <tr>
          <th style="text-align:left; padding:6px; font-size:11px; border-bottom:1px solid #e5e7eb;">#</th>
          <th style="text-align:left; padding:6px; font-size:11px; border-bottom:1px solid #e5e7eb;">Description</th>
          <th style="text-align:right; padding:6px; font-size:11px; border-bottom:1px solid #e5e7eb;">Bottles</th>
          <th style="text-align:right; padding:6px; font-size:11px; border-bottom:1px solid #e5e7eb;">Bottle size (L)</th>
          <th style="text-align:right; padding:6px; font-size:11px; border-bottom:1px solid #e5e7eb;">Total vol (L)</th>
          <th style="text-align:right; padding:6px; font-size:11px; border-bottom:1px solid #e5e7eb;">Unit price</th>
          <th style="text-align:right; padding:6px; font-size:11px; border-bottom:1px solid #e5e7eb;">Line total</th>
        </tr>
      </thead>
      <tbody>
        ${rowsHtml}
      </tbody>
    </table>

    <!-- Totals -->
    <table style="width:100%; margin-top:10px; font-size:11px;">
      <tr>
        <td style="width:50%;"></td>
        <td style="width:50%; text-align:right;">
          <div>
            <div>Total bottles: <strong>${totals.totalBottles}</strong></div>
            <div>Total volume: <strong>${
              totalVolumeStr ? totalVolumeStr + " L" : "-"
            }</strong></div>
            <div style="margin-top:4px; font-size:12px;">
              Total invoice value:
              <strong>${
                totalValueStr
                  ? `${totalValueStr} ${currency}`
                  : "-" + (currency ? " " + currency : "")
              }</strong>
            </div>
          </div>
        </td>
      </tr>
    </table>

    <!-- Notes -->
    <div style="margin-top:16px; font-size:10px; color:#4b5563; line-height:1.5;">
      This proforma invoice is issued for customs purposes only and does not constitute a tax invoice.<br/>
      Goods: wine – HS code 2204.21. No dangerous goods.<br/>
      All amounts are expressed in ${currency || "the indicated currency"}.
    </div>

    <!-- Signature -->
    <div style="margin-top:32px; font-size:11px;">
      <div>Place and date: _________________________________</div>
      <div style="margin-top:24px;">
        Signature: __________________________________________
      </div>
    </div>
  </div>
</body>
</html>`;
}

function renderDocumentHtml(doc: DocData): string | null {
  switch (doc.meta.docType) {
    case "fattura_proforma":
    case "fattura_commerciale":
      return renderProformaHtml(doc);
    default:
      return null; // DDT / DLE li aggiungiamo dopo
  }
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
      { ok: false, error: "UNEXPECTED_ERROR", details: String(e?.message || e) },
      { status: 500 }
    );
  }
}
