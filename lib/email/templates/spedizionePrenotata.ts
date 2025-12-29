// FILE: lib/email/templates/spedizionePrenotata.ts
function escapeHtml(s: any) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function asDateYYYYMMDD(x: any): string | null {
  if (!x) return null;
  const s = String(x);
  const m = s.match(/^(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : s.slice(0, 10) || null;
}

export function buildSpedizionePrenotataHtml(opts: {
  humanId: string;
  pickupDate?: string | null;
  carrier?: string | null;
  tracking?: string | null;
}) {
  const areaUrl = "https://spst-operations.vercel.app/dashboard/spedizioni";
  const waUrl = "https://wa.me/message/CP62RMFFDNZPO1";
  const logoUrl = "https://spst-operations.vercel.app/spst-logo.png";

  const humanId = opts.humanId;
  const pickupDate = asDateYYYYMMDD(opts.pickupDate);

  const hasCarrierOrTracking = Boolean(opts.carrier || opts.tracking);

  const preheader = pickupDate
    ? `Spedizione confermata. Ritiro previsto ${pickupDate}.`
    : `Spedizione confermata.`;

  const subject = `SPST • Spedizione confermata — ${humanId}`;

  const pickupBlock = pickupDate
    ? `<p style="margin:0 0 14px 0;color:#374151;font-size:14px;line-height:1.55;">
         <strong>Ritiro previsto:</strong> ${escapeHtml(pickupDate)}
       </p>`
    : "";

  const infoBox = hasCarrierOrTracking
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e7eb;border-radius:12px;background:#fff;margin:0 0 16px;">
        <tr>
          <td style="padding:12px 14px;font-size:14px;color:#0f172a;">
            <div style="margin:0 0 6px 0;"><strong>Corriere:</strong> ${escapeHtml(
              opts.carrier || "—"
            )}</div>
            <div><strong>Tracking:</strong> ${escapeHtml(opts.tracking || "—")}</div>
          </td>
        </tr>
      </table>`
    : "";

  const html = `<!doctype html>
<html lang="it">
  <head>
    <meta charset="utf-8"/>
    <meta name="viewport" content="width=device-width"/>
    <meta name="x-apple-disable-message-reformatting"/>
    <title>${escapeHtml(subject)}</title>
  </head>
  <body style="margin:0;background:#f6f8fb;font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Arial;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${escapeHtml(
      preheader
    )}</div>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f6f8fb;padding:24px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="680" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 2px 8px rgba(16,24,40,.06);border:1px solid #e2e8f0;">
            <tr>
              <td style="background:#1c3e5e;padding:18px 24px;">
                <img src="${escapeHtml(
                  logoUrl
                )}" alt="SPST" style="height:28px;display:block;border:0;filter:brightness(110%);" />
              </td>
            </tr>

            <tr>
              <td style="padding:24px;">
                <h1 style="margin:0 0 8px 0;font-size:20px;color:#0f172a;">Spedizione confermata</h1>

                <table role="presentation" style="width:100%;margin:6px 0 18px;">
                  <tr>
                    <td style="font-size:12px;color:#6b7280;padding-bottom:4px;">ID spedizione</td>
                  </tr>
                  <tr>
                    <td style="font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,'Liberation Mono','Courier New',monospace;font-size:14px;padding:10px 12px;border:1px solid #e5e7eb;border-radius:8px;background:#f9fafb;color:#111827;">
                      ${escapeHtml(humanId)}
                    </td>
                  </tr>
                </table>

                <p style="margin:0 0 10px 0;color:#374151;font-size:14px;line-height:1.55;">
                  Gentile Cliente, abbiamo ricevuto la tua richiesta di spedizione. Trovi documenti e aggiornamenti nella tua
                  <a href="${escapeHtml(
                    areaUrl
                  )}" style="color:#0a58ca;">Area Riservata SPST</a>.
                </p>

                ${pickupBlock}

                <p style="margin:0 0 18px 0;color:#374151;font-size:14px;line-height:1.55;">
                  Se ci dovessero essere problemi con il ritiro puoi riferirti al nostro
                  <a href="${escapeHtml(
                    waUrl
                  )}" style="color:#0a58ca;">Supporto WhatsApp</a>.
                </p>

                ${infoBox}

                <table role="presentation" cellpadding="0" cellspacing="0" style="margin:6px 0 18px;">
                  <tr>
                    <td>
                      <a href="${escapeHtml(
                        areaUrl
                      )}" target="_blank"
                         style="display:inline-block;background:#1c3e5e;color:#fff;text-decoration:none;padding:12px 16px;border-radius:10px;font-weight:600;font-size:14px;">
                        Area Riservata
                      </a>
                    </td>
                    <td style="width:10px"></td>
                    <td>
                      <a href="${escapeHtml(
                        waUrl
                      )}" target="_blank"
                         style="display:inline-block;background:#f7911e;color:#111827;text-decoration:none;padding:12px 16px;border-radius:10px;font-weight:600;font-size:14px;">
                        Supporto WhatsApp
                      </a>
                    </td>
                  </tr>
                </table>

                <p style="margin:0 0 18px 0;color:#374151;font-size:14px;">Grazie,<br/>Team SPST</p>
              </td>
            </tr>

            <tr>
              <td style="padding:16px 24px;background:#f3f4f6;color:#6b7280;font-size:12px;">
                <p style="margin:0;">Ricevi questa mail perché hai effettuato una spedizione con SPST.</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  return { subject, html };
}
