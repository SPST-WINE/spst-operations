import { NextRequest, NextResponse } from "next/server";
import { renderDocumentHtml } from "@/lib/docs/render";
import type { DocData } from "@/lib/docs/render/types";

import chromium from "@sparticuz/chromium-min";
import playwright from "playwright-core";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function generatePdfFromHtml(html: string): Promise<Uint8Array> {
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

  const pdfBuffer = await page.pdf({
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

  return pdfBuffer;
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
    const pdfBytes = await generatePdfFromHtml(html);

    const safeName =
      (doc.meta.docNumber || "document")
        .replace(/[^\w.-]+/g, "_")
        .slice(0, 80) + ".pdf";

    // 🔥 FIX FINALE: usare Response invece di NextResponse
    return new Response(pdfBytes, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${safeName}"`
      }
    });

  } catch (err: any) {
    console.error("[PDF ERROR]", err);
    return NextResponse.json(
      { ok: false, error: err?.message || "PDF_GENERATION_ERROR" },
      { status: 500 }
    );
  }
}
