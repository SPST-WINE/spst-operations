// lib/docs/render/shared/styles.ts

export const baseDocStyles = `
  * {
    box-sizing: border-box;
  }
  body {
    margin: 0;
    padding: 0;
    font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    font-size: 12px;
    color: #0f172a;
  }
  .page {
    width: 210mm;
    min-height: 297mm;
    padding: 18mm 18mm 20mm 18mm;
    margin: 0 auto;
    background: #ffffff;
    page-break-after: always;
  }
  .page:last-child {
    page-break-after: auto;
  }
  @media print {
    .page {
      page-break-after: always;
    }
    .page:last-child {
      page-break-after: auto;
    }
  }
  h1, h2, h3, h4 {
    margin: 0;
    font-weight: 600;
    color: #0f172a;
  }
  .section-title {
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: #6b7280;
    margin-bottom: 4px;
  }
  table {
    border-collapse: collapse;
    width: 100%;
  }
`;
