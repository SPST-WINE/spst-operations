// lib/docs/render/dle.ts
import type { DocData } from "./types";
import { renderBaseHtml } from "./shared/layout";
import { esc, renderAddressBlock } from "./shared/utils";

export function renderDleHtml(doc: DocData): string {
  const courier = (doc.meta.courier || "").toUpperCase();

  if (courier.includes("UPS")) return renderUpsDle(doc);
  if (courier.includes("FEDEX")) return renderFedexDle(doc);
  if (courier.includes("DHL")) return renderDhlDle(doc);

  // default: SPST / privati / altro
  return renderGenericDle(doc);
}
