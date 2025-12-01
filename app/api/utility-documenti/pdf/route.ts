// app/api/utility-documenti/pdf/route.ts

import { NextResponse } from "next/server";
import type { DocData } from "@/lib/docs/render/types";
import { PDFDocument, StandardFonts } from "pdf-lib";

export const runtime = "nodejs"; // OK in Vercel

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { html, title } = body as { html: string; title: string };

    if (!html) {
      return NextResponse.json(
        { error: "Missing HTML content" },
        { status: 400 }
      );
    }

    // 📄 Create a PDF
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([595, 842]); // A4
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

    const text = html
      .replace(/<[^>]+>/g, " ") // rimuove i tag HTML
      .replace(/\s+/g, " ")     // normalizza spazi
      .trim();

    page.setFont(font);
    page.setFontSize(11);
    page.drawText(text.slice(0, 5000), {
      x: 40,
      y: 780,
      maxWidth: 515,
      lineHeight: 14,
    });

   const pdfBytes = await pdfDoc.save();

// Converte il Uint8Array in un ArrayBuffer "pulito"
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
