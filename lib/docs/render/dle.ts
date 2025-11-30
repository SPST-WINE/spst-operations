// lib/docs/render/dle.ts
export function renderDleHtml(doc: DocData): string {
  const courier = doc.meta.courier?.toUpperCase() ?? "";

  switch (true) {
    case courier.includes("UPS"):
      return renderUpsDle(doc);
    case courier.includes("FEDEX"):
      return renderFedexDle(doc);
    case courier.includes("DHL"):
      return renderDhlDle(doc);       // possiamo farla semplice
    default:
      return renderGenericDle(doc);   // SPST / privati / altro
  }
}
