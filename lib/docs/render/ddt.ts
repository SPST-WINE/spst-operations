// lib/docs/render/ddt.ts
import type { DocData } from "./types";
import { renderBaseHtml } from "./shared/layout";
import { esc, renderAddressBlock, formatNumber } from "./shared/utils";

export function renderDdtHtml(doc: DocData): string {
  const { meta, parties, shipment, items, totals } = doc;

  const docNumber = esc(meta.docNumber);
  const docDate = esc(meta.docDate);
  const humanId = esc(meta.humanId || "");
  const courierStr = meta.courier ? esc(meta.courier) : "";
  const trackingStr = meta.trackingCode ? esc(meta.trackingCode) : "";

  const totalPackages =
    shipment.totalPackages != null ? String(shipment.totalPackages) : "-";
  const totalWeight =
    shipment.totalGrossWeightKg != null
      ? `${formatNumber(shipment.totalGrossWeightKg, 2)} kg`
      : "-";
  const totalBottles = totals.totalBottles ?? 0;
  const totalVolumeStr =
    totals.totalVolumeL != null ? `${formatNumber(totals.totalVolumeL, 2)} L` : "-";

  const originPlace =
    [parties.shipper.address.city, parties.shipper.address.country]
      .filter(Boolean)
      .join(" - ") || "-";

  const destinationPlace =
    [parties.consignee.address.city, parties.consignee.address.country]
      .filter(Boolean)
      .join(" - ") || "-";

  const pickupDate =
    shipment.pickupDate != null ? esc(String(shipment.pickupDate)) : docDate;

  // Causale / Porto: per ora default semplici, modificabili da editor
  const causaleTrasporto =
    (meta as any).causaleTrasporto ??
    (meta as any).causale ??
    "Vendita";
  const porto =
    (meta as any).porto ??
    "Franco";

  const documentNote =
    meta.docNotes ??
    (meta as any).docNotes ??
    (meta as any).note ??
    null;

  const rowsHtml =
    items.length === 0
      ? `<tr><td colspan="4" style="padding:8px;font-size:11px;color:#555;">Nessun articolo</td></tr>`
      : items
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
            <td style="padding:6px;border-bottom:1px solid #e5e7eb;">
              ${
                it.alcoholPercent != null
                  ? `Alc. ${formatNumber(it.alcoholPercent, 1)}% vol`
                  : it.itemType
                  ? esc(it.itemType)
                  : ""
              }
            </td>
          </tr>`;
          })
          .join("");

  const body = `
  <div class="page">

    <!-- Intestazione -->
    <table style="width:100%; margin-bottom:16px;">
      <tr>
        <td>
          <div style="font-size:18px;font-weight:700;letter-spacing:0.08em;">SPST</div>
          <div style="font-size:11px;color:#6b7280;margin-top:2px;">Specialized Wine Logistics</div>
        </td>
        <td style="text-align:right;">
          <div style="font-size:16px;font-weight:700;">DOCUMENTO DI TRASPORTO (DDT)</div>
          <div style="margin-top:4px;font-size:11px;color:#4b5563;">
            N. <strong>${docNumber}</strong><br/>
            Data: <strong>${docDate}</strong><br/>
            Spedizione: <strong>${humanId}</strong>
          </div>
          <div style="margin-top:6px;font-size:11px;color:#4b5563;">
            Vettore: <strong>${courierStr || "-"}</strong><br/>
            Tracking: <strong>${trackingStr || "-"}</strong>
          </div>
        </td>
      </tr>
    </table>

    <!-- Mittente / Destinatario -->
    <table style="width:100%; margin-bottom:16px;">
      <tr>
        <td style="width:50%; vertical-align:top; padding-right:8px;">
          <div class="section-title">Mittente</div>
          <div style="font-size:11px; line-height:1.4;">
            ${renderAddressBlock(parties.shipper)}
          </div>
        </td>
        <td style="width:50%; vertical-align:top;">
          <div class="section-title">Destinatario</div>
          <div style="font-size:11px; line-height:1.4;">
            ${renderAddressBlock(parties.consignee)}
          </div>
        </td>
      </tr>
    </table>

    <!-- Dati spedizione -->
    <table style="width:100%; margin-bottom:12px; font-size:11px;">
      <tr>
        <td style="width:50%; vertical-align:top; padding-right:8px;">
          <div class="section-title">Dati spedizione</div>
          <div style="line-height:1.5;">
            Luogo di partenza: <strong>${esc(originPlace)}</strong><br/>
            Luogo di consegna: <strong>${esc(destinationPlace)}</strong><br/>
            Data partenza: <strong>${pickupDate}</strong><br/>
            Numero colli: <strong>${totalPackages}</strong><br/>
            Peso lordo: <strong>${totalWeight}</strong><br/>
            Totale bottiglie: <strong>${totalBottles}</strong><br/>
            Volume totale: <strong>${totalVolumeStr}</strong><br/>
          </div>
        </td>
        <td style="width:50%; vertical-align:top;">
          <div class="section-title">Condizioni trasporto</div>
          <div style="line-height:1.5;">
            Causale trasporto: <strong>${esc(causaleTrasporto)}</strong><br/>
            Porto: <strong>${esc(porto)}</strong><br/>
            Descrizione merce: <strong>${
              shipment.contentSummary
                ? esc(shipment.contentSummary)
                : "Bottiglie di vino"
            }</strong><br/>
          </div>
        </td>
      </tr>
    </table>

    <!-- Articoli -->
    <div class="section-title" style="margin-bottom:4px;">Dettaglio merce</div>
    <table>
      <thead>
        <tr>
          <th style="padding:6px;border-bottom:1px solid #e5e7eb;">#</th>
          <th style="padding:6px;border-bottom:1px solid #e5e7eb;">Descrizione</th>
          <th style="padding:6px;border-bottom:1px solid #e5e7eb;text-align:right;">Quantità (bt)</th>
          <th style="padding:6px;border-bottom:1px solid #e5e7eb;">Note</th>
        </tr>
      </thead>
      <tbody>
        ${rowsHtml}
      </tbody>
    </table>

    <!-- Note -->
    <div style="margin-top:16px;font-size:10px;color:#4b5563;line-height:1.5;">
      ${
        documentNote
          ? `<div style="margin-bottom:6px;">${esc(documentNote)}</div>`
          : ""
      }
      Il presente documento accompagna la merce durante il trasporto ed è emesso ai sensi della normativa italiana sul documento di trasporto (DDT).<br/>
      La merce viaggia a rischio e pericolo del vettore secondo gli accordi contrattuali vigenti.
    </div>

    <!-- Firme -->
    <table style="width:100%; margin-top:32px; font-size:11px;">
      <tr>
        <td style="width:50%; vertical-align:top; padding-right:16px;">
          Luogo e data di consegna: _______________________________<br/><br/>
          Firma del destinatario:<br/><br/><br/>
          _______________________________
        </td>
        <td style="width:50%; vertical-align:top;">
          Luogo e data di presa in carico: ________________________<br/><br/>
          Firma del vettore / conducente:<br/><br/><br/>
          _______________________________
        </td>
      </tr>
    </table>

  </div>
  `;

  return renderBaseHtml({
    title: `DDT - ${docNumber}`,
    body,
  });
}
