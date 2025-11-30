// lib/docs/render/dle.ts
import type { DocData } from "./types";
import { renderBaseHtml } from "./shared/layout";
import { esc, renderAddressBlock, formatNumber } from "./shared/utils";

export function renderDleHtml(doc: DocData): string {
  const courier = (doc.meta.courier || "").toUpperCase();

  if (courier.includes("UPS")) return renderUpsDle(doc);
  if (courier.includes("FEDEX")) return renderFedexDle(doc);
  if (courier.includes("DHL")) return renderDhlDle(doc);

  // Default: SPST / corrieri privati / altro
  return renderGenericDle(doc);
}

/**
 * DLE UPS – replica il modello UPS Italia
 * Intestazione a destra e in grassetto, testo liscio
 */
function renderUpsDle(doc: DocData): string {
  const { meta, parties } = doc;
  const shipper = parties.shipper;

  const place =
    shipper.address.city || shipper.address.country || "________________";
  const date = meta.docDate || "____/____/________";

  const body = `
  <div class="page" style="font-family:system-ui,-apple-system,'Segoe UI',sans-serif;font-size:11px;color:#111827;padding-top:20mm;">

    <!-- Intestazione UPS, a destra e in grassetto -->
    <div style="margin-bottom:18px; text-align:right; font-weight:700;">
      <div>Spettabile</div>
      <div>UPS ITALIA Srl</div>
      <div>Via Orio al Serio 49/51</div>
      <div>24050 Grassobbio</div>
      <div>Attn. EXPORT DEPARTMENT</div>
    </div>

    <!-- Oggetto -->
    <div style="margin-bottom:14px;">
      <strong>Oggetto: dichiarazione di libera esportazione</strong>
    </div>

    <!-- Intro -->
    <div style="margin-bottom:12px; line-height:1.5;">
      Il sottoscritto __________________ in qualità di MITTENTE dichiara sotto la propria personale responsabilità
      che tutte le merci che la società
      <span style="display:inline-block; min-width:260px; border-bottom:1px solid #111827;">
        ${esc(shipper.name || "")}
      </span>
      affida ad UPS Italia SRL:
    </div>

    <!-- Elenco regolamenti UPS (testo liscio, niente box) -->
    <div style="line-height:1.5; margin-bottom:18px;">
      <div>
        Non rientrano tra quelle protette dalla Convenzione di Washington (CITES), come da regolamento (CE) n. 338/97 del Consiglio del 9
        dicembre 1996 e successive modifiche relativo alla protezione di specie della flora e della fauna selvatiche mediante il controllo del loro
        commercio.
      </div>
      <div style="margin-top:6px;">
        Non rientrano nell’elenco dei beni come da regolamento (CE) n. 116/2009 del Consiglio del 18 dicembre 2008 relativo all’esportazione
        di beni culturali.
      </div>
      <div style="margin-top:6px;">
        Non rientrano nell’elenco dei beni come da regolamento (UE) n. 821/2021 del Parlamento europeo e del Consiglio del 20 maggio 2021
        e successive modifiche che istituisce un regime dell’Unione di controllo delle esportazioni, dell’intermediazione, dell’assistenza tecnica,
        del transito e del trasferimento di prodotti a duplice uso.
      </div>
      <div style="margin-top:6px;">
        Non rientrano nell’elenco dei beni come da regolamento (UE) n. 125/2019 del Parlamento europeo e del Consiglio del 16 gennaio 2019
        e successive modifiche relativo al commercio di determinate merci che potrebbero essere utilizzate per la pena di morte, per la tortura
        o per altri trattamenti o pene crudeli, inumani o degradanti.
      </div>
      <div style="margin-top:6px;">
        Non contengono pelliccia di cane e di gatto in conformità al regolamento (CE) n. 1523/2007 del Parlamento europeo e del Consiglio
        dell’11 dicembre 2007.
      </div>
      <div style="margin-top:6px;">
        Non sono soggette alle disposizioni del regolamento (UE) n. 649/2012 del Parlamento europeo e del Consiglio del 4 luglio 2012 e
        successive modifiche sull’esportazione ed importazione di sostanze chimiche pericolose.
      </div>
      <div style="margin-top:6px;">
        Non rientrano nell’elenco dei beni come da regolamento (UE) 590/2024 del Parlamento europeo e del Consiglio del 7 febbraio 2024 e
        successive modifiche sulle sostanze che riducono lo strato di ozono.
      </div>
      <div style="margin-top:6px;">
        Non sono soggette alle disposizioni del regolamento (CE) n. 1013/2006 del Parlamento europeo e del Consiglio del 14 giugno 2006 e
        successive modifiche relativo alle spedizioni di rifiuti.
      </div>
      <div style="margin-top:6px;">
        Non rientrano nell’elenco dei beni come da regolamento (CE) n. 1210/2003 del Consiglio del 7 luglio 2003 e successive modifiche
        relativo a talune specifiche restrizioni alle relazioni economiche e finanziarie con l’Iraq.
      </div>
      <div style="margin-top:6px;">
        Non rientrano nell’elenco dei beni come da regolamento (UE) n. 2016/44 del Consiglio del 18 gennaio 2016 e successive modifiche
        concernente misure restrittive in considerazione della situazione in Libia.
      </div>
      <div style="margin-top:6px;">
        Non rientrano nell’elenco dei beni come da regolamento (UE) n. 36/2012 del Consiglio del 18 gennaio 2012 e successive modifiche
        concernente misure restrittive in considerazione della situazione in Siria.
      </div>
      <div style="margin-top:6px;">
        Non sono soggette alle disposizioni del regolamento (CE) n. 765/2006 del Consiglio del 18 maggio 2006 e successive modifiche
        concernente misure restrittive nei confronti della Bielorussia.
      </div>
      <div style="margin-top:6px;">
        Non sono soggette alle disposizioni del regolamento (UE) n. 833/2014 del Consiglio del 31 luglio 2014 e successive modifiche
        concernente misure restrittive in considerazione delle azioni della Russia che destabilizzano la situazione in Ucraina.
      </div>
      <div style="margin-top:6px;">
        Non sono soggette alle disposizioni della decisione 2014/512/PESC del Consiglio del 31 luglio 2014 e successive modifiche
        concernente misure restrittive in considerazione delle azioni della Russia che destabilizzano la situazione in Ucraina.
      </div>
      <div style="margin-top:6px;">
        Non sono soggette alle disposizioni del regolamento (UE) n. 692/2014 del Consiglio del 23 giugno 2014 e successive modifiche
        concernente restrizioni sulle importazioni nell'Unione di merci originarie della Crimea o Sebastopoli, in risposta all'annessione illegale
        della Crimea e di Sebastopoli.
      </div>
      <div style="margin-top:6px;">
        Non sono soggette alle disposizioni del regolamento (UE) n. 2022/263 del Consiglio del 23 febbraio 2022 e successive modifiche
        concernente misure restrittive in risposta al riconoscimento, all'occupazione o all'annessione illegali da parte della Federazione
        russa di alcune zone dell'Ucraina non controllate dal governo.
      </div>
    </div>

    <!-- Luogo / Data / Firma -->
    <div style="margin-top:24px;">
      <div style="margin-bottom:18px;">
        Luogo
        <span style="display:inline-block; min-width:220px; border-bottom:1px solid #111827;">
          ${esc(place)}
        </span>
      </div>
      <div style="margin-bottom:32px;">
        Data
        <span style="display:inline-block; min-width:220px; border-bottom:1px solid #111827;">
          ${esc(date)}
        </span>
      </div>
      <div style="margin-top:24px;">
        <div style="border-top:1px solid #111827; width:260px; text-align:center; padding-top:4px;">
          (timbro e firma)
        </div>
      </div>
    </div>

  </div>
  `;

  return renderBaseHtml({
    title: "Dichiarazione di libera esportazione - UPS",
    body,
  });
}

/**
 * DLE FedEx – modello esportatore
 * Intestazione sotto "To the attention..." e testo liscio, cumulation NO spuntata
 */
function renderFedexDle(doc: DocData): string {
  const { meta, parties } = doc;
  const shipper = parties.shipper;
  const consignee = parties.consignee;

  const place =
    shipper.address.city || shipper.address.country || "________________";
  const date = meta.docDate || "____/____/________";

  const invoiceNumber = meta.docNumber || "________________";
  const originCountry = shipper.address.country || "________________";
  const destCountry =
    consignee.address.country || "________________";

  const body = `
  <div class="page" style="font-family:system-ui,-apple-system,'Segoe UI',sans-serif;font-size:10px;color:#111827;padding-top:18mm;">

    <div style="font-size:9px; margin-bottom:8px;">
      (If the consignor is a company, the Declaration below must be printed on company letterhead)
    </div>

    <div style="margin-bottom:8px;">
      To the attention of the Customs Agency
    </div>

    <!-- Intestazione del mittente subito sotto, a sinistra -->
    <div style="font-size:10px; margin-bottom:12px;">
      <strong>${esc(shipper.name || "INTESTAZIONE DEL MITTENTE")}</strong><br/>
      ${shipper.address.line1 ? esc(shipper.address.line1) + "<br/>" : ""}
      ${shipper.address.postalCode ? esc(shipper.address.postalCode) + " " : ""}${
        shipper.address.city ? esc(shipper.address.city) : ""
      }
    </div>

    <div style="font-weight:600; text-transform:uppercase; margin-bottom:10px;">
      EXPORTER’S DECLARATION FOR FREE EXPORT / NON-RESTRICTED GOODS
    </div>

    <div style="margin-bottom:12px; line-height:1.5;">
      While accepting all consequent responsibilities for the shipment we hereby declare that none of the goods in export are
      subject to any export license and therefore:
    </div>

    <!-- GOODS OF EU PREFERENTIAL ORIGIN (testo liscio) -->
    <div style="margin-bottom:8px; font-weight:600;">
      GOODS OF EU PREFERENTIAL ORIGIN
    </div>
    <div style="margin-bottom:6px; line-height:1.5;">
      (please mark the box in case of goods of UE preferential origin and fill in the following mandatory declaration)
    </div>
    <div style="margin-bottom:4px; font-weight:600;">
      DECLARATION
    </div>
    <div style="line-height:1.5; margin-bottom:4px;">
      I, the undersigned, declare that the goods listed on this document (invoice number)
      <span style="border-bottom:1px solid #111827; padding:0 4px;">${esc(
        invoiceNumber
      )}</span>
      originate in
      <span style="border-bottom:1px solid #111827; padding:0 4px;">${esc(
        originCountry
      )}</span>
      and satisfy the rules of origin governing preferential trade with
      <span style="border-bottom:1px solid #111827; padding:0 4px;">${esc(
        destCountry
      )}</span>.
    </div>
    <div style="line-height:1.5; margin-top:4px;">
      I declare that:
    </div>
    <div style="line-height:1.5;">
      ☐ Cumulation applied with __________________ (name of the country/countries)<br/>
      ☑ No cumulation applied (origin from a single country)
    </div>
    <div style="line-height:1.5; margin-top:6px;">
      I undertake to make available to the customs authorities any further supporting documents they may require (for
      example: invoices, import documentation, statement of origin, invoice declaration, producer/manufacturer declaration,
      extracts of accounting documents, extracts of technical documentation, etc.):
    </div>
    <div style="margin-top:4px; line-height:1.5;">
      .......................................................................<br/>
      .......................................................................<br/>
      .......................................................................
    </div>

    <!-- GOODS DESTINED TO TURKEY -->
    <div style="margin-top:10px; margin-bottom:4px; font-weight:600;">
      GOODS DESTINED TO TURKEY
    </div>
    <div style="line-height:1.5; margin-bottom:6px;">
      (please mark the box in case of goods destined to Turkey)
    </div>
    <div style="line-height:1.5;">
      I declare that the goods meet the requirements for the application of UE/Turkey Agreement (Decision n.1/95 of the
      Council of Association CE-Turkey, of 22/12/1995 and 2006/646/CE: Decision n.1/2006 of the Customs Cooperation
      Committee CE-Turkey, of 26/09/2006)
    </div>

    <!-- MANDATE -->
    <div style="margin-top:10px; margin-bottom:4px; font-weight:600;">
      MANDATE TO ISSUE EUR1/EUR-MED/ATR CERTIFICATE
    </div>
    <div style="line-height:1.5;">
      We assign to <strong>FedEx</strong> the mandate to proceed with customs clearance activities, to issue, sign on our behalf and file the
      EUR1/EUR-MED/ATR certificate, relieving <strong>FedEx</strong> of any responsibilities directly or indirectly associated with the
      fulfillment of the above indicated procedure.
    </div>

    <!-- DUAL USE / WASHINGTON / etc. – tutto testo liscio -->
    <div style="margin-top:10px; margin-bottom:4px; font-weight:600;">
      DUAL USE (Y901)
    </div>
    <div style="line-height:1.5;">
      The goods are not included in the list of products as per Council Regulation (EC) No. 428/09 and its following
      amendments, instituting a control system on exported products and technologies with dual use, therefore the goods are
      only for civil use.
    </div>

    <div style="margin-top:10px; margin-bottom:4px; font-weight:600;">
      WASHINGTON CONVENTION (Y900)
    </div>
    <div style="line-height:1.5;">
      The goods are not included in the list of products as per Council Regulation (EC) No. 338/97 and its following
      amendments on the protection of endangered flora and fauna species through trade control.
    </div>

    <div style="margin-top:10px; margin-bottom:4px; font-weight:600;">
      CAT AND DOG FUR (Y922)
    </div>
    <div style="line-height:1.5;">
      The goods are not cat and dog fur and/or products which contain them, as per Council Regulation (EC) No. 1523/07 and
      its amendments that forbids trading, imports and exports of cat and dog fur.
    </div>

    <div style="margin-top:10px; margin-bottom:4px; font-weight:600;">
      OZONE (Y902)
    </div>
    <div style="line-height:1.5;">
      The goods are not included in the list of substances that cause ozone layer depletion as per Council Regulation (EC) No.
      1005/09 and its following modifications.
    </div>

    <div style="margin-top:10px; margin-bottom:4px; font-weight:600;">
      CULTURAL GOODS (Y903)
    </div>
    <div style="line-height:1.5;">
      The goods are not included in the list of products as per Council Regulation (EC) No. 116/09, and its amendments ruling
      export of cultural goods.
    </div>

    <div style="margin-top:10px; margin-bottom:4px; font-weight:600;">
      DANGEROUS CHEMICAL SUBSTANCES (Y916 – Y917)
    </div>
    <div style="line-height:1.5;">
      The goods are not included in the list of products as per appendixes I and V of Council Regulation (EU) No. 649/2012
      and its amendments, laying down detailed rules for the export and import of dangerous chemical substances.
    </div>

    <div style="margin-top:10px; margin-bottom:4px; font-weight:600;">
      GOODS USED FOR DEATH PENALTY, TORTURE ETC. – Y904 – Y906 – Y907- Y908
    </div>
    <div style="line-height:1.5;">
      The goods are not included in the list of products as per Council Regulation (EC) No. 1236/05, and its amendments
      laying down detailed rules for trading certain goods that could be used for death penalty, torture or for other cruel,
      inhuman or demeaning treatments or penalties.
    </div>

    <div style="margin-top:10px; font-size:9px;">
      Updated on November 2019
    </div>

    <div style="margin-top:10px; margin-bottom:4px; font-weight:600;">
      GOODS SENT TO ONE OF THE BELOW INDICATED COUNTRIES (Y920 – Y921 - Y949 - Y966 – Y967)
    </div>
    <div style="line-height:1.5;">
      The goods are not included in the list of products as per:<br/>
      Council Regulation (EC) No. 314/04 and its amendments, concerning certain restrictive measures in respect of
      Zimbabwe;<br/>
      Council Decision (CFSP) 2016/917 and its amendments, imposing restrictions on the supply of assistance related to
      military activities to Côte d’Ivoire;<br/>
      Council Regulation (EU) No. 1509/17 and its amendments, concerning restrictive measures against the Democratic
      People’s Republic of Korea;<br/>
      Council Regulation (EU) No. 401/13 and its amendments, renewing and strengthening the restrictive measures in
      respect of Myanmar;<br/>
      Council Regulation (EU) No. 44/16 and its amendments, concerning restrictive measures in view of the situation in Libya;<br/>
      Council Regulation (EU) No. 36/12 and its amendments, concerning restrictive measures in view of the situation in Syria;<br/>
      Council Regulation (EU) No. 267/12 and its amendments, concerning restrictive measures against Iran;<br/>
      Council Regulation (EU) No. 747/14 and its amendments, concerning restrictive measures in view of the situation in
      Sudan.
    </div>

    <div style="margin-top:10px; margin-bottom:4px; font-weight:600;">
      Y935
    </div>
    <div style="line-height:1.5;">
      The goods are not included in the list of products as per Council Regulation (EU) No. 1332/13 and its amendments,
      concerning restrictive measures in view of the situation in Syria.
    </div>

    <div style="margin-top:10px; margin-bottom:4px; font-weight:600;">
      GOODS SENT TO RUSSIA (Y939 – Y920)
    </div>
    <div style="line-height:1.5;">
      The goods are not included in the list of products as per Council Regulation (EU) No. 833/14 and Council Decision
      2014/512 and their amendments, concerning restrictive measures in view of Russia's actions destabilizing the situation in
      Ukraine.
    </div>

    <div style="margin-top:10px; margin-bottom:4px; font-weight:600;">
      WASTE (Y923)
    </div>
    <div style="line-height:1.5;">
      The goods are not included in the list of products as per Regulation (EC) No. 1013/2006 (GUCE L190) and its
      amendments of the European Parliament and of the Council of 14 June 2006 concerning restrictive measures for
      shipments of waste.
    </div>

    <!-- Place / signature -->
    <div style="margin-top:24px;">
      <div style="margin-bottom:22px;">
        Place and date
        <span style="display:inline-block; min-width:240px; border-bottom:1px solid #111827;">
          ${esc(place)} – ${esc(date)}
        </span>
      </div>
      <div style="margin-top:32px;">
        <div style="border-top:1px solid #111827; width:260px; text-align:center; padding-top:4px;">
          Shipper’s signature
        </div>
      </div>
    </div>

  </div>
  `;

  return renderBaseHtml({
    title: "Exporter declaration - FedEx",
    body,
  });
}

/**
 * DLE DHL – versione sintetica
 */
function renderDhlDle(doc: DocData): string {
  const { meta, parties, shipment, totals } = doc;
  const shipper = parties.shipper;
  const consignee = parties.consignee;

  const place =
    shipper.address.city || shipper.address.country || "________________";
  const date = meta.docDate || "____/____/________";

  const body = `
  <div class="page" style="font-family:system-ui,-apple-system,'Segoe UI',sans-serif;font-size:11px;color:#111827;padding-top:20mm;">

    <div style="margin-bottom:16px;">
      <strong>DICHIARAZIONE DI LIBERA ESPORTAZIONE</strong><br/>
      Corriere: DHL Express
    </div>

    <div style="margin-bottom:12px;">
      <strong>Mittente:</strong><br/>
      ${renderAddressBlock(shipper)}
    </div>

    <div style="margin-bottom:12px;">
      <strong>Destinatario:</strong><br/>
      ${renderAddressBlock(consignee)}
    </div>

    <div style="margin-bottom:12px; line-height:1.5;">
      Il sottoscritto, in qualità di esportatore, dichiara che la merce oggetto della spedizione
      consiste in bottiglie di vino (HS 2204.21), di origine Italia, non soggette a restrizioni
      particolari all'esportazione e non classificate come merci pericolose ai fini del trasporto.
    </div>

    <div style="margin-bottom:12px; line-height:1.5;">
      Totale bottiglie: <strong>${totals.totalBottles}</strong><br/>
      Volume totale: <strong>${
        totals.totalVolumeL != null ? totals.totalVolumeL.toFixed(2) + " L" : "-"
      }</strong><br/>
      Numero colli: <strong>${shipment.totalPackages ?? "-"}</strong><br/>
      Peso lordo: <strong>${
        shipment.totalGrossWeightKg != null
          ? formatNumber(shipment.totalGrossWeightKg, 2) + " kg"
          : "-"
      }</strong>
    </div>

    <div style="margin-top:24px;">
      Luogo e data:
      <span style="display:inline-block; min-width:240px; border-bottom:1px solid #111827;">
        ${esc(place)} – ${esc(date)}
      </span>
    </div>

    <div style="margin-top:40px;">
      <div style="border-top:1px solid #111827; width:260px; text-align:center; padding-top:4px;">
        Timbro e firma dell'esportatore
      </div>
    </div>

  </div>
  `;

  return renderBaseHtml({
    title: "Dichiarazione di libera esportazione - DHL",
    body,
  });
}

/**
 * DLE generica SPST – usata per SPST / privati / altri corrieri
 */
function renderGenericDle(doc: DocData): string {
  const { meta, parties, shipment, totals } = doc;
  const shipper = parties.shipper;
  const consignee = parties.consignee;

  const place =
    shipper.address.city || shipper.address.country || "________________";
  const date = meta.docDate || "____/____/________";

  const body = `
  <div class="page" style="font-family:system-ui,-apple-system,'Segoe UI',sans-serif;font-size:11px;color:#111827;padding-top:20mm;">

    <div style="margin-bottom:16px;">
      <strong>DICHIARAZIONE DI LIBERA ESPORTAZIONE</strong><br/>
      Corriere: ${esc(meta.courier || "SPST / corriere privato")}
    </div>

    <div style="margin-bottom:12px;">
      <strong>Mittente:</strong><br/>
      ${renderAddressBlock(shipper)}
    </div>

    <div style="margin-bottom:12px;">
      <strong>Destinatario:</strong><br/>
      ${renderAddressBlock(consignee)}
    </div>

    <div style="margin-bottom:12px; line-height:1.5;">
      Il sottoscritto, in qualità di esportatore, dichiara che la merce oggetto della spedizione
      consiste in bottiglie di vino (HS 2204.21), di origine Italia, non soggette a restrizioni
      particolari all'esportazione e non classificate come merci pericolose ai fini del trasporto.
    </div>

    <div style="margin-bottom:12px; line-height:1.5;">
      Totale bottiglie: <strong>${totals.totalBottles}</strong><br/>
      Volume totale: <strong>${
        totals.totalVolumeL != null ? totals.totalVolumeL.toFixed(2) + " L" : "-"
      }</strong><br/>
      Numero colli: <strong>${shipment.totalPackages ?? "-"}</strong><br/>
      Peso lordo: <strong>${
        shipment.totalGrossWeightKg != null
          ? formatNumber(shipment.totalGrossWeightKg, 2) + " kg"
          : "-"
      }</strong>
    </div>

    <div style="margin-top:24px;">
      Luogo e data:
      <span style="display:inline-block; min-width:240px; border-bottom:1px solid #111827;">
        ${esc(place)} – ${esc(date)}
      </span>
    </div>

    <div style="margin-top:40px;">
      <div style="border-top:1px solid #111827; width:260px; text-align:center; padding-top:4px;">
        Timbro e firma dell'esportatore
      </div>
    </div>

  </div>
  `;

  return renderBaseHtml({
    title: "Dichiarazione di libera esportazione",
    body,
  });
}
