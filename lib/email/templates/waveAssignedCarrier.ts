// FILE: lib/email/templates/waveAssignedCarrier.ts
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

function baseUrl() {
  return (
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.PUBLIC_APP_URL ||
    "https://spst-operations.vercel.app"
  ).replace(/\/$/, "");
}

export function buildWaveAssignedCarrierHtml(opts: {
  waveCode: string;
  waveId: string;
  plannedPickupDate?: string | null;
  pickupWindow?: string | null;
  shipmentsCount: number;
  palletsCount: number;
  carrierContactName?: string | null;
}) {
  const logoUrl = `${baseUrl()}/spst-logo.png`;
  const waUrl = "https://wa.me/message/CP62RMFFDNZPO1";
  const waveUrl = `${baseUrl()}/carrier/waves/${encodeURIComponent(opts.waveId)}`;

  const waveCode = opts.waveCode;
  const pickupDate = asDateYYYYMMDD(opts.plannedPickupDate);
  const pickupWindow = opts.pickupWindow ? String(opts.pickupWindow) : "—";
  const shipmentsCount = Number.isFinite(opts.shipmentsCount)
    ? opts.shipmentsCount
    : 0;
  const palletsCount = Number.isFinite(opts.palletsCount) ? opts.palletsCount : 0;
  const name = (opts.carrierContactName || "").trim();

  const preheader = pickupDate
    ? `Nuova wave assegnata. Ritiro previsto ${pickupDate} ${pickupWindow}. Apri la wave per i dettagli.`
    : `Nuova wave assegnata. Apri la wave per i dettagli.`;

  const subject = `SPST • Nuova wave assegnata — ${waveCode}`;

  const html = `<!doctype html>
<html lang="it">
  <head>
    <meta charset="utf-8"/>
    <meta name="viewport" content="width=device-width"/>
    <meta name="x-apple-disable-message-reformatting"/>
    <title>${escapeHtml(subject)}</title>
  </head>
  <body style="margin:0;background:#f6f8fb;font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Arial;">
    <!-- Preheader -->
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
                <h1 style="margin:0 0 8px 0;font-size:20px;color:#0f172a;font-weight:800;text-align:left;">
                  Nuova wave assegnata
                </h1>

                <p style="margin:0 0 14px 0;color:#374151;font-size:14px;line-height:1.55;">
                  ${name ? `Ciao <strong>${escapeHtml(name)}</strong>,` : `Ciao,`}
                  ti è stata assegnata una nuova wave di ritiri.
                  Apri i dettagli per vedere indirizzi, documenti e informazioni per ogni spedizione.
                </p>

                <table role="presentation" style="width:100%;margin:6px 0 18px;">
                  <tr>
                    <td style="font-size:12px;color:#6b7280;padding-bottom:4px;">Wave ID</td>
                  </tr>
                  <tr>
                    <td style="font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,'Liberation Mono','Courier New',monospace;font-size:14px;padding:10px 12px;border:1px solid #e5e7eb;border-radius:8px;background:#f9fafb;color:#111827;">
                      ${escapeHtml(waveCode)}
                    </td>
                  </tr>
                </table>

                <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;margin:0 0 18px;">
                  <tr>
                    <td style="width:33.33%;padding:10px 12px;border:1px solid #e5e7eb;border-radius:12px;background:#ffffff;">
                      <div style="font-size:12px;color:#6b7280;margin-bottom:4px;">Ritiro previsto</div>
                      <div style="font-size:14px;color:#111827;font-weight:700;">${escapeHtml(
                        pickupDate || "—"
                      )}</div>
                      <div style="font-size:12px;color:#6b7280;margin-top:4px;">
                        Finestra: <span style="color:#111827;font-weight:700;">${escapeHtml(
                          pickupWindow
                        )}</span>
                      </div>
                    </td>

                    <td style="width:12px;"></td>

                    <td style="width:33.33%;padding:10px 12px;border:1px solid #e5e7eb;border-radius:12px;background:#ffffff;">
                      <div style="font-size:12px;color:#6b7280;margin-bottom:4px;">Ritiri inclusi</div>
                      <div style="font-size:14px;color:#111827;font-weight:700;">${escapeHtml(
                        shipmentsCount
                      )}</div>
                      <div style="font-size:12px;color:#6b7280;margin-top:4px;">(numero spedizioni)</div>
                    </td>

                    <td style="width:12px;"></td>

                    <td style="width:33.33%;padding:10px 12px;border:1px solid #e5e7eb;border-radius:12px;background:#ffffff;">
                      <div style="font-size:12px;color:#6b7280;margin-bottom:4px;">Pallet totali</div>
                      <div style="font-size:14px;color:#111827;font-weight:700;">${escapeHtml(
                        palletsCount
                      )}</div>
                    </td>
                  </tr>
                </table>

                <p style="margin:0 0 18px 0;color:#374151;font-size:14px;line-height:1.55;">
                  Per qualsiasi esigenza o coordinamento urgente, puoi contattare il nostro
                  <a href="${escapeHtml(
                    waUrl
                  )}" style="color:#0a58ca;">Supporto WhatsApp</a>.
                </p>

                <table role="presentation" cellpadding="0" cellspacing="0" style="margin:6px 0 18px;">
                  <tr>
                    <td>
                      <a href="${escapeHtml(
                        waveUrl
                      )}" target="_blank"
                         style="display:inline-block;background:#1c3e5e;color:#fff;text-decoration:none;padding:12px 16px;border-radius:10px;font-weight:600;font-size:14px;">
                        Apri wave
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

                <p style="margin:0;color:#6b7280;font-size:12px;line-height:1.5;">
                  Se non riesci ad aprire il pulsante, copia questo link nel browser:<br/>
                  <span style="word-break:break-all;color:#0a58ca;">${escapeHtml(
                    waveUrl
                  )}</span>
                </p>
              </td>
            </tr>

            <tr>
              <td style="padding:16px 24px;background:#f3f4f6;color:#6b7280;font-size:12px;">
                <p style="margin:0;">Ricevi questa mail perché sei un trasportatore abilitato su SPST.</p>
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
