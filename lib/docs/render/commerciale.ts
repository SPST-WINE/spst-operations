// lib/docs/render/commerciale.ts
import type { DocData } from "./types";
import { renderBaseHtml } from "./shared/layout";
import { esc, renderAddressBlock, formatNumber } from "./shared/utils";

export function renderCommercialeHtml(doc: DocData): string {
  const { meta, parties, shipment, items, totals } = doc;

  const incotermStr = meta.incoterm ? esc(meta.incoterm) : "";
  const courierStr = meta.courier ? esc(meta.courier) : "";
  const trackingStr = meta.trackingCode ? esc(meta.trackingCode) : "";
  const currency = esc(totals.currency ?? meta.valuta ?? "EUR");

  // valori reali → nessuna sostituzione prezzo
  const valuedItems = items.map((it) => ({
    ...it,
    unitPrice: it.unitPrice ?? 0,
    lineTotal:
      it.unitPrice != null && it.bottles != null
        ? it.unitPrice * it.bottles
        : it.lineTotal ?? 0,
  }));

  const rowsHtml =
    valuedItems.length === 0
      ? `<tr><td colspan="8" style="padding:8px;font-size:11px;color:#555;">No items</td></tr>`
      : valuedItems
          .map((it, idx) => {
            return `
          <tr>
            <td style="padding:6px;border-bottom:1px solid #e5e7eb;">${idx + 1}</td>
            <td style="padding:6px;border-bottom:1px solid #e5e7eb;">${esc(
              it.description
            )}</td>
            <td style="padding:6px;border-bottom:1px solid #e5e7eb;text-align:right;">${
              it.bottles ?? ""
            }</td>
            <td style="padding:6px;border-bottom:1px solid #e5e7eb;text-align:right;">${
              it.volumePerBottleL != null
                ? formatNumber(it.volumePerBottleL, 2)
                : ""
            }</td>
            <td style="padding:6px;border-bottom:1px solid #e5e7eb;text-align:right;">${
              it.totalVolumeL != null
                ? formatNumber(it.totalVolumeL, 2)
                : ""
            }</td>
            <td style="padding:6px;border-bottom:1px solid #e5e7eb;text-align:right;">${
              it.alcoholPercent != null
                ? formatNumber(it.alcoholPercent, 1)
                : ""
            }</td>
            <td style="padding:6px;border-bottom:1px solid #e5e7eb;text-align:right;">${
              it.unitPrice != null ? formatNumber(it.unitPrice, 2) : ""
            }</td>
            <td style="padding:6px;border-bottom:1px solid #e5e7eb;text-align:right;">${
              it.lineTotal != null ? formatNumber(it.lineTotal, 2) : ""
            }</td>
          </tr>`;
          })
          .join("");

  const totalVolumeStr =
    totals.totalVolumeL != null ? formatNumber(totals.totalVolumeL, 2) : "-";

  // valore totale reale (sempre NET, senza IVA)
  const goodsValue = valuedItems.reduce(
    (sum, it) => sum + (it.lineTotal ?? 0),
    0
  );
  const goodsValueStr = formatNumber(goodsValue, 2);

  const destinationCountry =
    parties.consignee.address.country || parties.consignee.address.city || "";

  const body = `
  <div class="page">

    <!-- Header -->
    <table style="width:100%; margin-bottom:16px;">
      <tr>
        <td>
          <div style="font-size:18px;font-weight:700;letter-spacing:0.08em;">SPST</div>
          <div style="font-size:11px;color:#6b7280;margin-top:2px;">Specialized Wine Logistics</div>
        </td>
        <td style="text-align:right;">
          <div style="font-size:16px;font-weight:700;">COMMERCIAL INVOICE</div>
          <div style="margin-top:4px;font-size:11px;color:#4b5563;">
            No. <strong>${esc(meta.docNumber)}</strong><br/>
            Date: <strong>${esc(meta.docDate)}</strong><br/>
            Shipment ID: <strong>${esc(meta.humanId || "")}</strong>
          </div>
          <div style="margin-top:6px;font-size:11px;color:#4b5563;">
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
          <div class="section-title">Bill To</div>
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
            Total volume: <strong>${totalVolumeStr} L</strong><br/>
          </div>
        </td>
      </tr>
    </table>

    <!-- Items table -->
    <div class="section-title" style="margin-bottom:4px;">Items</div>

    <table>
      <thead>
        <tr>
          <th style="padding:6px;border-bottom:1px solid #e5e7eb;">#</th>
          <th style="padding:6px;border-bottom:1px solid #e5e7eb;">Description</th>
          <th style="padding:6px;border-bottom:1px solid #e5e7eb;text-align:right;">Bottles</th>
          <th style="padding:6px;border-bottom:1px solid #e5e7eb;text-align:right;">Bottle size (L)</th>
          <th style="padding:6px;border-bottom:1px solid #e5e7eb;text-align:right;">Total vol (L)</th>
          <th style="padding:6px;border-bottom:1px solid #e5e7eb;text-align:right;">Alc. % vol</th>
          <th style="padding:6px;border-bottom:1px solid #e5e7eb;text-align:right;">Unit price</th>
          <th style="padding:6px;border-bottom:1px solid #e5e7eb;text-align:right;">Line total</th>
        </tr>
      </thead>
      <tbody>
        ${rowsHtml}
      </tbody>
    </table>

    <!-- Totals -->
    <table style="width:100%; margin-top:12px; font-size:11px;">
      <tr>
        <td style="width:50%;"></td>
        <td style="width:50%; text-align:right;">
          <div>
            <div style="margin-bottom:4px;">
              Goods value (net of VAT):
              <strong>${goodsValueStr} ${currency}</strong>
            </div>
            <div style="margin-top:6px; font-size:12px;">
              <strong>Total invoice value: ${goodsValueStr} ${currency}</strong>
            </div>
          </div>
        </td>
      </tr>
    </table>

    <!-- Legal notes -->
    <div style="margin-top:18px;font-size:10px;color:#4b5563;line-height:1.5;">
      Commercial invoice for export of alcoholic beverages.<br/>
      Amounts indicated are net of VAT and refer to the value of goods only.<br/>
      HS code 2204.21 — wine. Country of origin: Italy.<br/>
      No dangerous goods. Alcoholic beverages — Alc. % vol indicated per line item.
    </div>

    <!-- Signature -->
    <div style="margin-top:28px;font-size:11px;">
      <div>Place and date: ________________________________</div>
      <div style="margin-top:24px;">Signature: __________________________________________</div>
    </div>

  </div>
  `;

  return renderBaseHtml({
    title: `Commercial Invoice - ${esc(meta.docNumber)}`,
    body,
  });
}
