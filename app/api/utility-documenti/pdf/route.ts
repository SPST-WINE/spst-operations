// app/api/utility-documenti/pdf/route.ts
import { PDFDocument, StandardFonts } from "pdf-lib";
import type { DocData } from "@/lib/docs/render/types";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const doc: DocData = await req.json();

    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage();
    const { width, height } = page.getSize();

    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

    const metaAny = (doc as any).meta || {};
    const title =
      metaAny.title ||
      metaAny.docType ||
      "Documento di trasporto";

    // HEADER
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

    // Primo item
    const firstItem = doc.items?.[0];
    if (firstItem) {
      page.drawText(`Articolo: ${firstItem.description ?? ""}`, {
        x: 50,
        y: height - 150,
        size: 12,
        font,
      });
    }

    // Salva → Uint8Array
    const pdfBytes: Uint8Array = await pdfDoc.save();

    // CREA BLOB (supportato 100% in API ROUTES Next.js)
    const blob = new Blob([pdfBytes], { type: "application/pdf" });

    return new Response(blob, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": 'attachment; filename="documento-spst.pdf"',
      },
    });
  } catch (err) {
    console.error("[utility-documenti] pdf error", err);

    return new Response(
      JSON.stringify({ ok: false, error: "Errore nella generazione del PDF" }),
      { status: 500 }
    );
  }
}
