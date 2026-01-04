import type { DocData } from "./types";
import { renderBaseHtml } from "./shared/layout";
import { esc, renderAddressBlock, formatNumber, renderSpstLogo } from "./shared/utils";

export function renderDdtHtml(doc: DocData): string {
  const { meta, parties, shipment, items, totals } = doc;

  const docNumber = esc(meta.docNumber);
  const docDate = esc(meta.docDate);
  const humanId = esc(meta.humanId || "");
  const courierStr = meta.courier ? esc(meta.courier) : "";
  const trackingStr = meta.trackingCode ? esc(meta.trackingCode) : "";

  // Determina se è vino o altro
  const isVino = shipment.sorgente === "vino";
  const isAltro = shipment.sorgente === "altro";
  
  // Nome azienda in base a sorgente
  const companyName = isAltro ? "Specialized Pallet Logistics" : "Specialized Wine Logistics";

  const totalPackages =
    shipment.totalPackages != null && shipment.totalPackages > 0 ? shipment.totalPackages : 1;
  const totalPackagesStr = String(totalPackages);
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

  // 🔹 Righe dettaglio merce – colonne condizionali in base a sorgente
  const rowsHtml =
    items.length === 0
      ? `<tr><td colspan="${isVino ? "4" : "2"}" style="padding:8px;font-size:11px;color:#555;">Nessun articolo</td></tr>`
      : items
          .map((it, idx) => {
            const alcStr =
              it.alcoholPercent != null
                ? `Alc. ${formatNumber(it.alcoholPercent, 1)}% vol`
                : "";

            if (isVino) {
              return `
          <tr>
            <td style="padding:6px;border-bottom:1px solid #e5e7eb;">${idx + 1}</td>
            <td style="padding:6px;border-bottom:1px solid #e5e7eb;">${esc(
              it.description
            )}</td>
            <td style="padding:6px;border-bottom:1px solid #e5e7eb;text-align:right;">${
              it.bottles ?? ""
            }</td>
            <td style="padding:6px;border-bottom:1px solid #e5e7eb;text-align:right;">${alcStr}</td>
          </tr>`;
            } else {
              return `
          <tr>
            <td style="padding:6px;border-bottom:1px solid #e5e7eb;">${idx + 1}</td>
            <td style="padding:6px;border-bottom:1px solid #e5e7eb;">${esc(
              it.description
            )}</td>
          </tr>`;
            }
          })
          .join("");

  // Header tabelle condizionale
  const tableHeader = isVino
    ? `
      <thead>
        <tr>
          <th style="padding:6px;border-bottom:1px solid #e5e7eb;">#</th>
          <th style="padding:6px;border-bottom:1px solid #e5e7eb;">Descrizione</th>
          <th style="padding:6px;border-bottom:1px solid #e5e7eb;text-align:right;">Quantità (bt)</th>
          <th style="padding:6px;border-bottom:1px solid #e5e7eb;text-align:right;">Alc. % vol</th>
        </tr>
      </thead>`
    : `
      <thead>
        <tr>
          <th style="padding:6px;border-bottom:1px solid #e5e7eb;">#</th>
          <th style="padding:6px;border-bottom:1px solid #e5e7eb;">Descrizione</th>
        </tr>
      </thead>`;

  // Dati spedizione condizionale (rimuovi Totale bottiglie e Volume totale per altro)
  const datiSpedizioneRows = isVino
    ? `
            Luogo di partenza: <strong>${esc(originPlace)}</strong><br/>
            Luogo di consegna: <strong>${esc(destinationPlace)}</strong><br/>
            Data partenza: <strong>${pickupDate}</strong><br/>
            Numero colli: <strong>${totalPackagesStr}</strong><br/>
            Peso lordo: <strong>${totalWeight}</strong><br/>
            Totale bottiglie: <strong>${totalBottles}</strong><br/>
            Volume totale: <strong>${totalVolumeStr}</strong><br/>`
    : `
            Luogo di partenza: <strong>${esc(originPlace)}</strong><br/>
            Luogo di consegna: <strong>${esc(destinationPlace)}</strong><br/>
            Data partenza: <strong>${pickupDate}</strong><br/>
            Numero colli: <strong>${totalPackagesStr}</strong><br/>
            Peso lordo: <strong>${totalWeight}</strong><br/>`;

  // Funzione per generare una singola pagina
  const renderPage = (pageNum: number, totalPages: number) => {
    const pageIndicator = totalPages > 1 
      ? `<div style="position:absolute;top:10mm;right:18mm;font-size:10px;color:#6b7280;">${pageNum} di ${totalPages}</div>`
      : "";
    
    return `
  <div class="page" style="position:relative;">
    ${pageIndicator}

    <!-- Intestazione -->
    <table style="width:100%; margin-bottom:16px;">
      <tr>
        <td>
          ${renderSpstLogo()}
          <div style="font-size:11px;color:#6b7280;margin-top:4px;">${esc(companyName)}</div>
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
            ${datiSpedizioneRows}
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
                : isVino ? "Bottiglie di vino" : "Merce"
            }</strong><br/>
          </div>
        </td>
      </tr>
    </table>

    <!-- Articoli -->
    <div class="section-title" style="margin-bottom:4px;">Dettaglio merce</div>
    <table>
      ${tableHeader}
      <tbody>
        ${rowsHtml}
      </tbody>
    </table>

    <!-- Note documento -->
    <div style="margin-top:16px;font-size:10px;color:#4b5563;line-height:1.5;">
      ${
        documentNote
          ? `<div style="margin-bottom:6px;">${esc(documentNote)}</div>`
          : ""
      }
      Il presente documento accompagna la merce durante il trasporto ed è emesso ai sensi della normativa italiana sul documento di trasporto (DDT).<br/>
      La merce viaggia a rischio e pericolo del vettore secondo gli accordi contrattuali vigenti.
    </div>

    <!-- Firme (più spaziose e ordinate) -->
    <table style="width:100%; margin-top:32px; font-size:11px;">
      <tr>
        <td style="width:50%; vertical-align:top; padding-right:24px;">
          <div>Luogo e data di consegna:</div>
          <div style="margin-top:8px; border-bottom:1px solid #000; height:18px;"></div>

          <div style="margin-top:24px;">Firma del destinatario:</div>
          <div style="margin-top:8px; border-bottom:1px solid #000; height:18px;"></div>
        </td>

        <td style="width:50%; vertical-align:top; padding-left:24px;">
          <div>Luogo e data di presa in carico:</div>
          <div style="margin-top:8px; border-bottom:1px solid #000; height:18px;"></div>

          <div style="margin-top:24px;">Firma del vettore / conducente:</div>
          <div style="margin-top:8px; border-bottom:1px solid #000; height:18px;"></div>
        </td>
      </tr>
    </table>

  </div>`;
  };

  // Genera una pagina per ogni collo
  const pages = [];
  for (let i = 1; i <= totalPackages; i++) {
    pages.push(renderPage(i, totalPackages));
  }

  const body = pages.join("\n");

  return renderBaseHtml({
    title: `DDT - ${docNumber}`,
    body,
  });
}
