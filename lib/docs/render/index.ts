// lib/docs/render/index.ts
import type { DocData } from "./types";
import { renderCommercialeHtml } from "./commerciale";
import { renderProformaHtml } from "./proforma";

export function renderDocumentHtml(doc: DocData): string | null {
  switch (doc.meta.docType) {
    case "fattura_proforma":
      return renderProformaHtml(doc);

    case "fattura_commerciale":
      return renderCommercialeHtml(doc);

    default:
      return null;
  }
}
