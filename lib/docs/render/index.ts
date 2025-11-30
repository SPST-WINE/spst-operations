// lib/docs/render/index.ts
import type { DocData } from "./types";
import { renderProformaHtml } from "./proforma";
import { renderCommercialeHtml } from "./commerciale";
import { renderDdtHtml } from "./ddt";
import { renderDleHtml } from "./dle";

/**
 * Entry point unico per tutti i renderer HTML.
 * Viene chiamato dalla route /api/utility-documenti/genera e dalla
 * /api/utility-documenti/pdf per generare l'HTML del documento.
 */
export function renderDocumentHtml(doc: DocData): string {
  const docType = (doc.meta.docType || "").toLowerCase();

  switch (docType) {
    // 🔹 FATTURA PROFORMA
    case "fattura_proforma":
    case "proforma":
    case "proforma_invoice":
      return renderProformaHtml(doc);

    // 🔹 FATTURA COMMERCIALE
    case "fattura_commerciale":
    case "commercial_invoice":
    case "invoice_commerciale":
      return renderCommercialeHtml(doc);

    // 🔹 DDT ITALIANO
    case "ddt":
    case "documento_trasporto":
    case "ddt_italia":
      return renderDdtHtml(doc);

    // 🔹 DICHIARAZIONE DI LIBERA ESPORTAZIONE
    case "dle":
    case "dichiarazione_libera_esportazione":
    case "dichiarazione_di_libera_esportazione":
      return renderDleHtml(doc);

    default: {
      // Fallback "furbo" in base al testo del docType (per future varianti)
      if (docType.includes("proforma")) return renderProformaHtml(doc);
      if (docType.includes("commercial")) return renderCommercialeHtml(doc);
      if (docType.includes("ddt")) return renderDdtHtml(doc);
      if (docType.includes("dle") || docType.includes("libera_esportazione")) {
        return renderDleHtml(doc);
      }

      throw new Error(`Unsupported docType for document renderer: ${doc.meta.docType}`);
    }
  }
}
