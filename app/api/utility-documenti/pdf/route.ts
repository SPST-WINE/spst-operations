import type { DocData } from "@/lib/docs/render/types";
export const runtime = "nodejs";

// ⚡ Usa JSDOM invece di Chromium/Playwright (che non esiste più)
import { JSDOM } from "jsdom";

// Render HTML → PDF via jsPDF (solo lato server)
import { jsPDF } from "jspdf";

export async function POST(req: Request) {
  try {
    console.log("[utility-documenti] pdf route start");

    const body = await req.json();
    const html: string | null = body?.html ?? null;
    const filename: string = body?.filename ?? "document.pdf";

    if (!html) {
      console.error("[utility-documenti] Missing HTML");
      return Response.json({ ok: false, error: "MISSING_HTML" }, { status: 400 });
    }

    // 1. Render HTML in JSDOM
    const dom = new JSDOM(html);
    const doc = dom.window.document;

    // 2. Genera PDF
    const pdf = new jsPDF({
      unit: "pt",
      format: "a4"
    });

    pdf.html(doc.body, {
      callback: function (pdfResult) {
        console.log("[utility-documenti] PDF generated");
      },
      x: 10,
      y: 10,
      width: 575
    });

    const pdfBytes = pdf.output("arraybuffer");

    console.log("[utility-documenti] done, returning PDF");

    return new Response(pdfBytes, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`
      }
    });

  } catch (err: any) {
    console.error("[utility-documenti] error:", err);
    return Response.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
