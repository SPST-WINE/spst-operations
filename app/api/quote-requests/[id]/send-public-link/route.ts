import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";
import { requireStaff } from "@/lib/auth/requireStaff";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

function makeSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) return null;

  return createClient(url, key, {
    auth: { persistSession: false },
    db: { schema: "spst" },
  });
}

function jsonError(status: number, error: string, extra?: Record<string, any>) {
  return NextResponse.json({ ok: false, error, ...extra }, { status });
}

function formatDate(s?: string | null) {
  if (!s) return "—";
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return s;
  return d.toLocaleDateString("it-IT");
}

function formatCurrency(amount?: number | null, currency?: string | null) {
  if (amount == null) return "—";
  try {
    return new Intl.NumberFormat("it-IT", {
      style: "currency",
      currency: currency || "EUR",
    }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${currency || "EUR"}`;
  }
}

function escapeHtml(x: any) {
  return String(x ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function buildEmailHtml(params: {
  quoteId: string;
  humanId?: string | null;
  publicUrl: string;
  pickupDate?: string | null;
  incoterm?: string | null;
  currency?: string | null;
  declaredValue?: number | null;
  whatsappUrl?: string;
}) {
  const {
    quoteId,
    humanId,
    publicUrl,
    pickupDate,
    incoterm,
    currency,
    declaredValue,
    whatsappUrl,
  } = params;

  const titleId = humanId || quoteId;
  const preheader = `Quotazione pronta. Apri il link per vedere le opzioni e confermare.`;
  const dv =
    declaredValue != null && declaredValue > 0
      ? formatCurrency(declaredValue, currency || "EUR")
      : null;

  return `<!doctype html>
<html lang="it">
  <head>
    <meta charset="utf-8"/>
    <meta name="viewport" content="width=device-width"/>
    <meta name="x-apple-disable-message-reformatting"/>
    <title>SPST • Quotazione pronta — ${escapeHtml(titleId)}</title>
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
                <img src="https://cdn.prod.website-files.com/6800cc3b5f399f3e2b7f2ffa/68079e968300482f70a36a4a_output-onlinepngtools%20(1).png" alt="SPST" style="height:28px;display:block;border:0;filter:brightness(110%);" />
              </td>
            </tr>

            <tr>
              <td style="padding:24px;">
                <h1 style="margin:0 0 8px 0;font-size:20px;color:#0f172a;">Quotazione pronta</h1>

                <table role="presentation" style="width:100%;margin:6px 0 18px;">
                  <tr>
                    <td style="font-size:12px;color:#6b7280;padding-bottom:4px;">ID quotazione</td>
                  </tr>
                  <tr>
                    <td style="font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,'Liberation Mono','Courier New',monospace;font-size:14px;padding:10px 12px;border:1px solid #e5e7eb;border-radius:8px;background:#f9fafb;color:#111827;">
                      ${escapeHtml(titleId)}
                    </td>
                  </tr>
                </table>

                <p style="margin:0 0 10px 0;color:#374151;font-size:14px;line-height:1.55;">
                  Gentile Cliente, abbiamo preparato la tua quotazione. Apri il link qui sotto per visualizzare le opzioni disponibili e confermare quella preferita.
                </p>

                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e7eb;border-radius:12px;background:#fff;margin:0 0 16px;">
                  <tr>
                    <td style="padding:12px 14px;font-size:14px;color:#0f172a;">
                      <div style="margin:0 0 6px 0;"><strong>Data ritiro:</strong> ${escapeHtml(
                        formatDate(pickupDate)
                      )}</div>
                      <div style="margin:0 0 6px 0;"><strong>Incoterm:</strong> ${escapeHtml(
                        incoterm || "—"
                      )}</div>
                      ${
                        dv
                          ? `<div><strong>Valore assicurato:</strong> ${escapeHtml(
                              dv
                            )}</div>`
                          : `<div><strong>Valore assicurato:</strong> —</div>`
                      }
                    </td>
                  </tr>
                </table>

                <table role="presentation" cellpadding="0" cellspacing="0" style="margin:6px 0 18px;">
                  <tr>
                    <td>
                      <a href="${escapeHtml(
                        publicUrl
                      )}" target="_blank"
                         style="display:inline-block;background:#1c3e5e;color:#fff;text-decoration:none;padding:12px 16px;border-radius:10px;font-weight:600;font-size:14px;">
                        Apri quotazione
                      </a>
                    </td>
                    <td style="width:10px"></td>
                    <td>
                      <a href="${escapeHtml(
                        whatsappUrl || "https://wa.me/message/CP62RMFFDNZPO1"
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
                <p style="margin:0;">Ricevi questa mail perché hai richiesto una quotazione a SPST.</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

export async function POST(req: NextRequest, ctx: { params: { id: string } }) {
  const staff = await requireStaff();
  if ("response" in staff) return staff.response;

  const supabase = makeSupabase();
  if (!supabase) return jsonError(500, "MISSING_SUPABASE_ENV");

  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) return jsonError(500, "MISSING_RESEND_API_KEY");

  const quoteId = ctx.params.id;

  try {
    const { data: quote, error } = await supabase
      .from("quotes")
      .select(
        "id,human_id,status,declared_value,incoterm,created_at,email_cliente,public_token,data_ritiro,valuta,fields"
      )
      .eq("id", quoteId)
      .single();

    if (error || !quote) {
      return jsonError(404, "QUOTE_NOT_FOUND", { details: error?.message });
    }

    const emailTo =
      quote.email_cliente ||
      quote.fields?.customerEmail ||
      quote.fields?.email_cliente ||
      quote.fields?.createdByEmail;

    if (!emailTo) {
      return jsonError(400, "MISSING_CUSTOMER_EMAIL", {
        message: "Email cliente non presente sulla quotazione.",
      });
    }

    if (!quote.public_token) {
      return jsonError(400, "MISSING_PUBLIC_TOKEN", {
        message: "Genera prima il link pubblico (public_token).",
      });
    }

    const publicBase =
      process.env.NEXT_PUBLIC_PUBLIC_QUOTE_BASE_URL ||
      "https://spst-operations.vercel.app/quote";

    const publicUrl = `${publicBase}/${quote.public_token}`;

    const html = buildEmailHtml({
      quoteId: quote.id,
      humanId: quote.human_id,
      publicUrl,
      pickupDate: quote.data_ritiro,
      incoterm: quote.incoterm,
      currency: quote.valuta,
      declaredValue: quote.declared_value,
      whatsappUrl: "https://wa.me/message/CP62RMFFDNZPO1",
    });

    const resend = new Resend(resendKey);

    const from = process.env.RESEND_FROM || "SPST <notification@spst.it>";
    const subject = `SPST • Quotazione pronta — ${quote.human_id || quote.id}`;

    const sent = await resend.emails.send({
      from,
      to: emailTo,
      subject,
      html,
    });

    await supabase
      .from("quotes")
      .update({
        fields: {
          ...(quote.fields || {}),
          quote_link_sent_at: new Date().toISOString(),
          quote_link_sent_to: emailTo,
          quote_public_url: publicUrl,
        },
        status:
          (quote.status || "").toLowerCase().includes("inviat")
            ? quote.status
            : "Inviata al cliente",
      })
      .eq("id", quoteId);

    return NextResponse.json(
      { ok: true, to: emailTo, publicUrl, resend: sent },
      { status: 200 }
    );
  } catch (e: any) {
    console.error("[send-public-link] error:", e);
    return jsonError(500, "SERVER_ERROR", { message: e?.message });
  }
}
