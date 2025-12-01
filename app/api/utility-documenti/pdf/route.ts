// app/api/utility-documenti/pdf/route.ts

import { NextResponse } from "next/server";
import { PDFDocument, StandardFonts } from "pdf-lib";
import type { DocData } from "@/lib/docs/render/types";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    // Il client invia il DocData in JSON
    const doc: DocData = await req.json();

    // Crea un nuovo PDF vuoto
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage();
    const { width, height } = page.getSize();

    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

    // NON facciamo affidamento su meta.title (non esiste nel tipo)
    const metaAny = (doc as any).meta || {};
    const title: string =
      metaAny.title ||
      metaAny.docType ||
      "Documento di trasporto";

    // Header molto semplice
    page.drawText("SPST – Documento", {
      x: 50,
      y: height - 80,
      size: 18,
      font,
    });

    page.drawText(title, {
      x: 50,
      y: height - 110,
      size: 14,
      font,
    });

    // Se c'è almeno una riga, stampiamo la descrizione
    const firstItem = doc.items?.[0];
    if (firstItem) {
      page.drawText(`Articolo: ${firstItem.description ?? ""}`, {
        x: 50,
        y: height - 150,
        size: 12,
        font,
      });
    }

    // Salva il PDF in memoria
    const pdfBytes = await pdfDoc.save();

    // Converte il Uint8Array in ArrayBuffer per NextResponse
    const pdfArrayBuffer = pdfBytes.buffer.slice(
      pdfBytes.byteOffset,
      pdfBytes.byteOffset + pdfBytes.byteLength
    );

    return new NextResponse(pdfArrayBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": 'attachment; filename="documento-spst.pdf"',
      },
    });
  } catch (err) {
    console.error("[utility-documenti] pdf error", err);

    return NextResponse.json(
      { ok: false, error: "Errore nella generazione del PDF" },
      { status: 500 }
    );
  }
}
