// app/api/utility-documenti/pdf/route.ts
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import type { DocData } from "@/lib/docs/render/types";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const doc: DocData = await req.json();

    // -------------------------------
    // Setup PDF (A4)
    // -------------------------------
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([595.28, 841.89]); // A4 in pt
    const { width, height } = page.getSize();

    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    // Usiamo "any" per non farci bloccare da TS su chiavi dinamiche di meta/parties
    const meta: any = (doc as any).meta ?? {};
    const parties: any = (doc as any).parties ?? {};
    const shipment: any = (doc as any).shipment ?? {};

    const mittente =
      parties.mittente || parties.sender || parties.seller || parties.shipper || {};
    const destinatario =
      parties.destinatario ||
      parties.receiver ||
      parties.buyer ||
      parties.consignee ||
      {};

    const items = doc.items ?? [];

    const title =
      meta.title ||
      meta.docType ||
      "Documento di trasporto";

    const docNumber = meta.docNumber ?? meta.numeroDocumento ?? "";
    const docDate = meta.docDate ?? meta.dataDocumento ?? "";
    const incoterm = meta.incoterm ?? "";
    const courier = meta.courier ?? meta.corriere ?? "";
    const trackingCode = meta.trackingCode ?? meta.tracking ?? "";
    const noteDocumento = meta.docNotes ?? meta.noteDocumento ?? "";

    // Helpers
    const drawText = (
      text: string,
      x: number,
      y: number,
      options?: { size?: number; color?: any; bold?: boolean }
    ) => {
      const { size = 9, color = rgb(0, 0, 0), bold = false } = options || {};
      page.drawText(text, {
        x,
        y,
        size,
        font: bold ? fontBold : font,
        color,
      });
    };

    const drawLabelValue = (
      label: string,
      value: string,
      x: number,
      y: number,
      labelWidth = 70
    ) => {
      drawText(label, x, y, { size: 8, bold: true });
      drawText(value ?? "", x + labelWidth, y, { size: 8 });
    };

    // -------------------------------
    // HEADER SPST
    // -------------------------------
    drawText("SPST", 50, height - 60, {
      size: 18,
      bold: true,
      color: rgb(0, 0, 0),
    });
    drawText("Specialized Wine Logistics", 50, height - 78, {
      size: 9,
      color: rgb(0.2, 0.2, 0.2),
    });

    drawText(title, width - 250, height - 60, {
      size: 14,
      bold: true,
    });

    if (docNumber) {
      drawLabelValue("Doc n°:", String(docNumber), width - 250, height - 80);
    }
    if (docDate) {
      drawLabelValue("Data:", String(docDate), width - 250, height - 92);
    }
    if (incoterm) {
      drawLabelValue("Incoterm:", String(incoterm), width - 250, height - 104);
    }
    if (courier) {
      drawLabelValue("Corriere:", String(courier), width - 250, height - 116);
    }
    if (trackingCode) {
      drawLabelValue("Tracking:", String(trackingCode), width - 250, height - 128);
    }

    // Linea orizzontale
    page.drawLine({
      start: { x: 50, y: height - 140 },
      end: { x: width - 50, y: height - 140 },
      thickness: 0.5,
      color: rgb(0.7, 0.7, 0.7),
    });

    // -------------------------------
    // SOGGETTI: MITTENTE / DESTINATARIO
    // -------------------------------
    let currentY = height - 160;

    drawText("MITTENTE", 50, currentY, { size: 9, bold: true });
    drawText("DESTINATARIO", width / 2 + 10, currentY, { size: 9, bold: true });

    currentY -= 12;

    const mittenteLines = [
      mittente.name ?? mittente.ragioneSociale ?? "",
      mittente.address ?? mittente.indirizzo ?? "",
      [
        mittente.cap,
        mittente.city ?? mittente.citta,
        mittente.country ?? mittente.paese,
      ]
        .filter(Boolean)
        .join(" "),
      mittente.vatNumber ?? mittente.piva ?? mittente.vat ?? "",
      mittente.reference ?? mittente.referente ?? "",
    ].filter((l) => l && String(l).trim() !== "");

    const destLines = [
      destinatario.name ?? destinatario.ragioneSociale ?? "",
      destinatario.address ?? destinatario.indirizzo ?? "",
      [
        destinatario.cap,
        destinatario.city ?? destinatario.citta,
        destinatario.country ?? destinatario.paese,
      ]
        .filter(Boolean)
        .join(" "),
      destinatario.vatNumber ?? destinatario.piva ?? destinatario.vat ?? "",
      destinatario.reference ?? destinatario.referente ?? "",
    ].filter((l) => l && String(l).trim() !== "");

    const linesCount = Math.max(mittenteLines.length, destLines.length);
    for (let i = 0; i < linesCount; i++) {
      if (mittenteLines[i]) {
        drawText(String(mittenteLines[i]), 50, currentY, { size: 8 });
      }
      if (destLines[i]) {
        drawText(String(destLines[i]), width / 2 + 10, currentY, { size: 8 });
      }
      currentY -= 10;
    }

    // DETTAGLI SPEDIZIONE (sotto i soggetti)
    currentY -= 8;
    drawText("DETTAGLI SPEDIZIONE", 50, currentY, { size: 9, bold: true });
    currentY -= 12;

    const shipDetailLines: string[] = [];

    if (shipment.originCountry || shipment.destinationCountry) {
      shipDetailLines.push(
        `Origine: ${shipment.originCountry ?? ""}  →  Destinazione: ${
          shipment.destinationCountry ?? ""
        }`
      );
    }
    if (shipment.pickupDate) {
      shipDetailLines.push(`Data ritiro: ${shipment.pickupDate}`);
    }
    if (shipment.totalPackages) {
      shipDetailLines.push(`Colli totali: ${shipment.totalPackages}`);
    }
    if (shipment.grossWeightKg || shipment.totalVolumeL) {
      shipDetailLines.push(
        `Peso lordo: ${shipment.grossWeightKg ?? ""} kg  •  Volume: ${
          shipment.totalVolumeL ?? ""
        } L`
      );
    }

    for (const line of shipDetailLines) {
      drawText(line, 50, currentY, { size: 8 });
      currentY -= 10;
    }

    // -------------------------------
    // TABELLONE ITEMS
    // -------------------------------
    currentY -= 14;

    const tableStartY = currentY;
    const colX = {
      idx: 50,
      desc: 65,
      bottles: 290,
      vol: 340,
      totalVol: 390,
      unitPrice: 450,
      lineTotal: 510,
    };

    // Header tabella
    drawText("#", colX.idx, tableStartY, { size: 8, bold: true });
    drawText("Descrizione", colX.desc, tableStartY, { size: 8, bold: true });
    drawText("Bott.", colX.bottles, tableStartY, { size: 8, bold: true });
    drawText("Vol/bt", colX.vol, tableStartY, { size: 8, bold: true });
    drawText("Vol tot", colX.totalVol, tableStartY, { size: 8, bold: true });
    drawText("Prezzo", colX.unitPrice, tableStartY, { size: 8, bold: true });
    drawText("Totale", colX.lineTotal, tableStartY, { size: 8, bold: true });

    // Linea sotto header
    page.drawLine({
      start: { x: 50, y: tableStartY - 2 },
      end: { x: width - 50, y: tableStartY - 2 },
      thickness: 0.4,
      color: rgb(0.7, 0.7, 0.7),
    });

    // Righe
    let rowY = tableStartY - 14;
    const maxRows = 25; // per non uscire dalla pagina

    items.slice(0, maxRows).forEach((it, idx) => {
      const n = idx + 1;
      const desc = it.description ?? "";
      const bottles = it.bottles ?? "";
      const volPerBottle = it.volumePerBottleL ?? it.volume_l ?? "";
      const totalVol = it.totalVolumeL ?? "";
      const unitPrice = it.unitPrice ?? "";
      const lineTotal = it.lineTotal ?? "";
      const currency = it.currency ?? meta.valuta ?? "";

      drawText(String(n), colX.idx, rowY, { size: 8 });
      drawText(String(desc), colX.desc, rowY, { size: 8 });
      if (bottles !== "") drawText(String(bottles), colX.bottles, rowY, { size: 8 });
      if (volPerBottle !== "")
        drawText(String(volPerBottle), colX.vol, rowY, { size: 8 });
      if (totalVol !== "")
        drawText(String(totalVol), colX.totalVol, rowY, { size: 8 });
      if (unitPrice !== "")
        drawText(String(unitPrice), colX.unitPrice, rowY, { size: 8 });
      if (lineTotal !== "") {
        drawText(String(lineTotal), colX.lineTotal, rowY, { size: 8 });
        if (currency) {
          drawText(String(currency), colX.lineTotal + 30, rowY, { size: 7 });
        }
      }

      rowY -= 12;
    });

    // -------------------------------
    // NOTE DOCUMENTO
    // -------------------------------
    if (noteDocumento) {
      rowY -= 14;
      drawText("Note:", 50, rowY, { size: 9, bold: true });
      rowY -= 12;

      const maxWidth = width - 100;
      const words = String(noteDocumento).split(/\s+/);
      let line = "";
      for (const w of words) {
        const testLine = line ? line + " " + w : w;
        const widthTest = font.widthOfTextAtSize(testLine, 8);
        if (widthTest > maxWidth) {
          drawText(line, 50, rowY, { size: 8 });
          rowY -= 10;
          line = w;
        } else {
          line = testLine;
        }
      }
      if (line) {
        drawText(line, 50, rowY, { size: 8 });
      }
    }

    // -------------------------------
    // SALVATAGGIO E RESPONSE
    // -------------------------------
    const pdfBytes: Uint8Array = await pdfDoc.save();
    const buffer = Buffer.from(pdfBytes);

    const fileName = docNumber
      ? `SPST-${String(docNumber)}.pdf`
      : "documento-spst.pdf";

    return new Response(buffer, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Length": buffer.length.toString(),
        "Content-Disposition": `attachment; filename="${fileName}"`,
      },
    });
  } catch (err) {
    console.error("[utility-documenti] pdf error", err);

    return new Response(
      JSON.stringify({
        ok: false,
        error: "Errore nella generazione del PDF",
      }),
      { status: 500 }
    );
  }
}
