// lib/docs/render/index.ts
import type { DocData } from "./types";
import { renderProformaHtml } from "./proforma";
import { renderCommercialeHtml } from "./commerciale";
import { renderDdtHtml } from "./ddt";

export function renderDocumentHtml(doc: DocData): string | null {
  switch (doc.meta.docType) {
    case "fattura_proforma":
      return renderProformaHtml(doc);

    case "fattura_commerciale":
      return renderCommercialeHtml(doc);

    // 🔹 DDT italiano
    case "ddt":
    case "documento_trasporto":
    case "ddt_italia":
      return renderDdtHtml(doc);

    default:
      return null;
  }
}
