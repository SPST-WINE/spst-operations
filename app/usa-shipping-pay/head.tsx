// app/usa-shipping-pay/head.tsx

export default function Head() {
  const title = "SPST US Shipping & Duties";
  const description =
    "Generate secure payment links for US wine shipping and customs duties with SPST.";

  const url = "https://spst-operations.vercel.app/usa-shipping-pay";

  return (
    <>
      <title>{title}</title>
      <meta name="description" content={description} />

      {/* Open Graph / WhatsApp / social */}
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:type" content="website" />
      <meta property="og:url" content={url} />

      {/* opzionale: se hai un’immagine preview dedicata */}
      {/* <meta property="og:image" content="https://spst.it/qualcosa.png" /> */}

      {/* Twitter cards (optional) */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
    </>
  );
}
