// lib/docs/render/index.ts
import type { DocData } from "./types";
import { renderProformaHtml } from "./proforma";

export function renderDocumentHtml(doc: DocData): string | null {
  switch (doc.meta.docType) {
    case "fattura_proforma":
    case "fattura_commerciale":
      return renderProformaHtml(doc);
    default:
      // DDT / DLE li aggiungeremo qui in seguito
      return null;
  }
}
