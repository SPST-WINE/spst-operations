// app/api/utility-documenti/pdf/route.ts
import { NextRequest, NextResponse } from "next/server";
import { renderDocumentHtml } from "@/lib/docs/render";
import type { DocData } from "@/lib/docs/render/types";

import chromium from "@sparticuz/chromium-min";
import playwright from "playwright-core";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function generatePdfFromHtml(html: string): Promise<ArrayBuffer> {
  const executablePath = await chromium.executablePath();

  const browser = await playwright.chromium.launch({
    args: chromium.args,
    executablePath,
    headless: true
  });

  const page = await browser.newPage({
    viewport: { width: 794, height: 1123 }
  });

  await page.setContent(html, { waitUntil: "networkidle" });

  const pdfBytes = await page.pdf({
    format: "A4",
    printBackground: true,
    margin: {
      top: "10mm",
      right: "10mm",
      bottom: "15mm",
      left: "10mm"
    }
  });

  await browser.close();

  // 👇 FIX FINALE: convert Uint8Array → ArrayBuffer
  return pdfBytes.buffer.slice(
    pdfBytes.byteOffset,
    pdfBytes.byteOffset + pdfBytes.byteLength
  );
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const doc = body?.doc as DocData | undefined;

    if (!doc) {
      return NextResponse.json(
        { ok: false, error: "MISSING_DOC" },
        { status: 400 }
      );
    }

    const html = renderDocumentHtml(doc);
    const arrayBuffer = await generatePdfFromHtml(html);

    const fileName =
      (doc.meta.docNumber || "document")
        .replace(/[^\w.-]+/g, "_")
        .slice(0, 80) + ".pdf";

    // 👇 FINAL WORKING RESPONSE
    return new Response(arrayBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${fileName}"`
      }
    });
  } catch (error: any) {
    console.error("[PDF ERROR]", error);
    return NextResponse.json(
      { ok: false, error: error?.message || "PDF_GENERATION_ERROR" },
      { status: 500 }
    );
  }
}
