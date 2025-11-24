// app/api/spedizioni/[id]/evasa/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "";
const SUPABASE_SERVICE_ROLE =
  process.env.SUPABASE_SERVICE_ROLE || process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const RESEND_API_KEY = process.env.RESEND_API_KEY || "";

function makeSupabase() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE) {
    throw new Error("Supabase env vars mancanti");
  }
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE, {
    auth: { persistSession: false },
  });
}

function buildEmailHtml(opts: {
  humanId: string;
  ritiroDateLabel: string;
  carrierLabel: string;
  trackingLabel: string;
}) {
  const { humanId, ritiroDateLabel, carrierLabel, trackingLabel } = opts;

  const preheader =
    ritiroDateLabel !== "—"
      ? `Spedizione in transito. Ritiro previsto ${ritiroDateLabel}.`
      : "Spedizione in transito.";

  return `<!doctype html>
<html lang="it">
  <head>
    <meta charset="utf-8"/>
    <meta name="viewport" content="width=device-width"/>
    <meta name="x-apple-disable-message-reformatting"/>
    <title>SPST • Spedizione in transito — ${humanId}</title>
  </head>
  <body style="margin:0;background:#f6f8fb;font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Arial;">
    <!-- Preheader -->
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${preheader}</div>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f6f8fb;padding:24px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="680" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 2px 8px rgba(16,24,40,.06);border:1px solid #e2e8f0;">
            <!-- Header blu -->
            <tr>
              <td style="background:#1c3e5e;padding:18px 24px;">
                <img src="https://cdn.prod.website-files.com/6800cc3b5f399f3e2b7f2ffa/68079e968300482f70a36a4a_output-onlinepngtools%20(1).png" alt="SPST" style="height:28px;display:block;border:0;filter:brightness(110%);" />
              </td>
            </tr>

            <!-- Body -->
            <tr>
              <td style="padding:24px;">
                <h1 style="margin:0 0 8px 0;font-size:20px;color:#0f172a;">Spedizione in transito</h1>

                <!-- ID box -->
                <table role="presentation" style="width:100%;margin:6px 0 18px;">
                  <tr>
                    <td style="font-size:12px;color:#6b7280;padding-bottom:4px;">ID spedizione</td>
                  </tr>
                  <tr>
                    <td style="font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,'Liberation Mono','Courier New',monospace;font-size:14px;padding:10px 12px;border:1px solid #e5e7eb;border-radius:8px;background:#f9fafb;color:#111827;">
                      ${humanId}
                    </td>
                  </tr>
                </table>

                <p style="margin:0 0 10px 0;color:#374151;font-size:14px;line-height:1.55;">
                  Gentile Cliente, la tua spedizione è stata evasa. Trovi i documenti da stampare all'interno della tua
                  <a href="https://app.spst.it/" style="color:#0a58ca;">Area Riservata SPST</a>.
                </p>

                <p style="margin:0 0 14px 0;color:#374151;font-size:14px;line-height:1.55;">
                  <strong>Ritiro previsto:</strong> ${ritiroDateLabel}
                </p>

                <p style="margin:0 0 18px 0;color:#374151;font-size:14px;line-height:1.55;">
                  Se ci dovessero essere problemi con il ritiro puoi riferirti al nostro
                  <a href="https://wa.me/message/CP62RMFFDNZPO1" style="color:#0a58ca;">Supporto WhatsApp</a>.
                </p>

                <!-- Info box -->
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e7eb;border-radius:12px;background:#fff;margin:0 0 16px;">
                  <tr>
                    <td style="padding:12px 14px;font-size:14px;color:#0f172a;">
                      <div style="margin:0 0 6px 0;"><strong>Corriere:</strong> ${carrierLabel}</div>
                      <div><strong>Tracking:</strong> ${trackingLabel}</div>
                    </td>
                  </tr>
                </table>

                <!-- CTAs -->
                <table role="presentation" cellpadding="0" cellspacing="0" style="margin:6px 0 18px;">
                  <tr>
                    <td>
                      <a href="https://app.spst.it/" target="_blank"
                         style="display:inline-block;background:#1c3e5e;color:#fff;text-decoration:none;padding:12px 16px;border-radius:10px;font-weight:600;font-size:14px;">
                        Area Riservata
                      </a>
                    </td>
                    <td style="width:10px"></td>
                    <td>
                      <a href="https://wa.me/message/CP62RMFFDNZPO1" target="_blank"
                         style="display:inline-block;background:#f7911e;color:#111827;text-decoration:none;padding:12px 16px;border-radius:10px;font-weight:600;font-size:14px;">
                        Supporto WhatsApp
                      </a>
                    </td>
                  </tr>
                </table>

                <p style="margin:0 0 18px 0;color:#374151;font-size:14px;">Grazie,<br/>Team SPST</p>
              </td>
            </tr>

            <!-- Footer grigio -->
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
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const id = params.id;

  if (!id) {
    return NextResponse.json(
      { ok: false, error: "ID spedizione mancante" },
      { status: 400 }
    );
  }

  if (!RESEND_API_KEY) {
    console.error("[evasa] RESEND_API_KEY mancante");
    return NextResponse.json(
      { ok: false, error: "Email non configurata" },
      { status: 500 }
    );
  }

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }
  const toEmail: string | null =
    typeof body.to === "string" && body.to.trim() !== ""
      ? body.to.trim()
      : null;

  if (!toEmail) {
    return NextResponse.json(
      { ok: false, error: "Email destinatario mancante" },
      { status: 400 }
    );
  }

  try {
    const supa = makeSupabase();

    // Recupero dati spedizione
    const { data, error } = await supa
      .schema("spst")
      .from("shipments")
      .select(
        `
        id,
        human_id,
        email_cliente,
        email_norm,
        giorno_ritiro,
        carrier,
        tracking_code
      `
      )
      .eq("id", id)
      .single();

    if (error || !data) {
      console.error("[evasa] errore db:", error);
      return NextResponse.json(
        { ok: false, error: "Spedizione non trovata" },
        { status: 404 }
      );
    }

    const emailDb =
      (data.email_cliente as string | null) ||
      (data.email_norm as string | null) ||
      "";

    // check sicurezza: la mail passata deve coincidere con quella a db
    if (
      !emailDb ||
      emailDb.trim().toLowerCase() !== toEmail.trim().toLowerCase()
    ) {
      return NextResponse.json(
        { ok: false, error: "Email non corrispondente al cliente" },
        { status: 400 }
      );
    }

    const humanId = (data.human_id as string | null) || data.id;
    const ritiroDateIso = data.giorno_ritiro as string | null;

    let ritiroLabel = "—";
    if (ritiroDateIso) {
      const d = new Date(ritiroDateIso);
      if (!Number.isNaN(d.getTime())) {
        ritiroLabel = d.toLocaleDateString("it-IT");
      }
    }

    const carrierLabel =
      (data.carrier as string | null) && String(data.carrier).trim() !== ""
        ? String(data.carrier)
        : "Da definire";
    const trackingLabel =
      (data.tracking_code as string | null) &&
      String(data.tracking_code).trim() !== ""
        ? String(data.tracking_code)
        : "—";

    const html = buildEmailHtml({
      humanId,
      ritiroDateLabel: ritiroLabel,
      carrierLabel,
      trackingLabel,
    });

    const resend = new Resend(RESEND_API_KEY);

    const sendRes = await resend.emails.send({
      from: "SPST <info@spst.it>",
      to: [toEmail],
      subject: `SPST • Spedizione in transito — ${humanId}`,
      html,
    });

    if (sendRes.error) {
      console.error("[evasa] resend error:", sendRes.error);
      return NextResponse.json(
        { ok: false, error: "Errore nell'invio email" },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[evasa] unexpected error:", e);
    return NextResponse.json(
      { ok: false, error: "Errore interno" },
      { status: 500 }
    );
  }
}
