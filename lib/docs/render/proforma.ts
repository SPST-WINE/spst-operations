// lib/docs/render/proforma.ts
import type { DocData } from "./types";
import { renderBaseHtml } from "./shared/layout";
import { esc, renderAddressBlock, formatNumber } from "./shared/utils";

export function renderProformaHtml(doc: DocData): string {
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
              it.volumePerBottleL != null
                ? formatNumber(it.volumePerBottleL, 2)
                : ""
            }</td>
            <td style="padding:6px;border-bottom:1px solid #e5e7eb;text-align:right;font-size:11px;">${
              it.totalVolumeL != null
                ? formatNumber(it.totalVolumeL, 2)
                : ""
            }</td>
            <td style="padding:6px;border-bottom:1px solid #e5e7eb;text-align:right;font-size:11px;">${
              it.unitPrice != null ? formatNumber(it.unitPrice, 2) : ""
            }</td>
            <td style="padding:6px;border-bottom:1px solid #e5e7eb;text-align:right;font-size:11px;">${
              it.lineTotal != null ? formatNumber(it.lineTotal, 2) : ""
            }</td>
          </tr>`;
          })
          .join("");

  const totalVolumeStr = formatNumber(totals.totalVolumeL, 2);
  const totalValueStr = formatNumber(totals.totalValue, 2);
  const currency = esc(totals.currency ?? meta.valuta ?? "");

  const destinationCountry =
    parties.consignee.address.country || parties.consignee.address.city || "";

  // 🔹 Note documento (editabili da UI)
  const documentNote = (meta as any).note as string | null | undefined;

  // 🔹 Fee per riga (opzionale) – es. 0.50 €/riga
  const feePerRowEur =
    (meta as any).feePerRowEur != null
      ? Number((meta as any).feePerRowEur)
      : null;
  const lineCount = items.length;
  const serviceFeeTotal =
    feePerRowEur != null && lineCount > 0 ? feePerRowEur * lineCount : null;

  const goodsValue = totals.totalValue ?? null;
  const goodsValueStr = goodsValue != null ? formatNumber(goodsValue, 2) : "";

  const serviceFeeStr =
    serviceFeeTotal != null ? formatNumber(serviceFeeTotal, 2) : "";

  const grandTotal =
    goodsValue != null && serviceFeeTotal != null
      ? goodsValue + serviceFeeTotal
      : null;
  const grandTotalStr =
    grandTotal != null ? formatNumber(grandTotal, 2) : "";

  const body = `
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

            <div style="margin-top:6px; font-size:12px;">
              Goods value:
              <strong>${
                goodsValueStr
                  ? `${goodsValueStr} ${currency}`
                  : "-" + (currency ? " " + currency : "")
              }</strong>
            </div>

            ${
              serviceFeeTotal != null
                ? `<div style="margin-top:2px; font-size:11px;">
                     Service fee (${formatNumber(
                       feePerRowEur!,
                       2
                     )} €/line × ${lineCount}):
                     <strong>${serviceFeeStr} ${currency}</strong>
                   </div>`
                : ""
            }

            ${
              grandTotal != null
                ? `<div style="margin-top:6px; font-size:12px;">
                     Grand total:
                     <strong>${grandTotalStr} ${currency}</strong>
                   </div>`
                : ""
            }
          </div>
        </td>
      </tr>
    </table>

    <!-- Notes -->
    <div style="margin-top:16px; font-size:10px; color:#4b5563; line-height:1.5;">
      ${
        documentNote
          ? `<div style="margin-bottom:6px;">${esc(documentNote)}</div>`
          : ""
      }
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
  `;

  return renderBaseHtml({
    title: `Proforma Invoice - ${esc(meta.docNumber)}`,
    body,
  });
}
