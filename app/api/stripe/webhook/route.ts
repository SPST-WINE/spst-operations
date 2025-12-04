// app/api/stripe/webhook/route.ts
import { headers } from "next/headers";
import Stripe from "stripe";
import { NextRequest } from "next/server";
import { Resend } from "resend";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
const resend = new Resend(process.env.RESEND_API_KEY!);
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;

export async function POST(req: NextRequest) {
  const body = await req.text();
  const sig = headers().get("stripe-signature");

  if (!sig) {
    return new Response("Missing stripe-signature header", { status: 400 });
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
  } catch (err: any) {
    console.error("[stripe webhook] signature error", err?.message);
    return new Response(`Webhook Error: ${err.message}`, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    await handleCheckoutCompleted(session);
  }

  return new Response("ok", { status: 200 });
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  try {
    const metadata = session.metadata || {};

    const wineryName = metadata.winery_name || "Winery";
    const wineryEmail = metadata.winery_email;
    const customerEmail = metadata.customer_email;

    const bottleCount = metadata.bottle_count || "0";
    const goodsValue = metadata.goods_value || "0";
    const shipping = metadata.shipping || "0";
    const duties = metadata.duties || "0";
    const stripeFee = metadata.stripe_fee || "0";
    const total = metadata.total || "0";

    const fromEmail = process.env.DUTIES_FROM_EMAIL || "no-reply@spst.it";

    // Email al cliente (EN)
    if (customerEmail) {
      await resend.emails.send({
        from: `SPST <${fromEmail}>`,
        to: customerEmail,
        subject: "Your payment has been received – SPST US Wine Shipping",
        html: buildCustomerEmail({
          wineryName,
          bottleCount,
          goodsValue,
          shipping,
          duties,
          stripeFee,
          total,
        }),
      });
    }

    // Email alla cantina (IT)
    if (wineryEmail) {
      await resend.emails.send({
        from: `SPST <${fromEmail}>`,
        to: wineryEmail,
        subject: "Pagamento trasporto + dazi confermato (SPST – USA)",
        html: buildWineryEmail({
          wineryName,
          customerEmail,
          bottleCount,
          goodsValue,
          shipping,
          duties,
          stripeFee,
          total,
        }),
      });
    }
  } catch (err) {
    console.error("[webhook handleCheckoutCompleted] error", err);
  }
}

function formatEuro(n: string): string {
  const num = Number(n);
  if (!Number.isFinite(num)) return "0,00";
  return num.toFixed(2).replace(".", ",");
}

/* ------------------------------------------
   EMAIL CLIENTE USA (INGLESE) — HTML PREMIUM
------------------------------------------- */
function buildCustomerEmail(data: {
  wineryName: string;
  bottleCount: string;
  goodsValue: string;
  shipping: string;
  duties: string;
  stripeFee: string;
  total: string;
}): string {
  return `
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8"/>
    <meta name="viewport" content="width=device-width"/>
    <meta name="x-apple-disable-message-reformatting"/>
    <title>Your SPST Shipment Payment is Confirmed</title>
  </head>
  <body style="margin:0;background:#f6f8fb;font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Arial;">
    
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">
      Your payment for US wine shipping is confirmed.
    </div>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f6f8fb;padding:24px 12px;">
      <tr>
        <td align="center">

          <table role="presentation" width="680" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 2px 8px rgba(16,24,40,.06);border:1px solid #e2e8f0;">
            
            <tr>
              <td style="background:#1c3e5e;padding:18px 24px;">
                <img src="https://cdn.prod.website-files.com/6800cc3b5f399f3e2b7f2ffa/68079e968300482f70a36a4a_output-onlinepngtools%20(1).png" 
                     alt="SPST" style="height:28px;display:block;border:0;filter:brightness(110%);" />
              </td>
            </tr>

            <tr>
              <td style="padding:24px;">

                <h1 style="margin:0 0 8px 0;font-size:20px;color:#0f172a;">
                  Your Payment is Confirmed
                </h1>

                <p style="margin:0 0 14px 0;color:#374151;font-size:14px;line-height:1.55;">
                  Thank you for your purchase. Your wine shipment from <strong>${data.wineryName}</strong> is now being processed.
                </p>

                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" 
                       style="border:1px solid #e5e7eb;border-radius:12px;background:#fff;margin:0 0 18px;">
                  <tr>
                    <td style="padding:12px 14px;font-size:14px;color:#0f172a;">
                      <div><strong>Bottles:</strong> ${data.bottleCount}</div>
                      <div><strong>Goods value:</strong> €${formatEuro(data.goodsValue)}</div>
                      <div><strong>Shipping:</strong> €${formatEuro(data.shipping)}</div>
                      <div><strong>Duties (15%):</strong> €${formatEuro(data.duties)}</div>
                      <div><strong>Stripe fees:</strong> €${formatEuro(data.stripeFee)}</div>
                      <hr style="border:0;border-top:1px solid #e5e7eb;margin:10px 0;"/>
                      <div style="font-size:15px;font-weight:600;">
                        Total Paid: €${formatEuro(data.total)}
                      </div>
                    </td>
                  </tr>
                </table>

                <p style="margin:0 0 14px 0;color:#374151;font-size:14px;line-height:1.55;">
                  Our logistics team is now preparing your shipment. You will receive tracking updates as soon as your order departs.
                </p>

                <table role="presentation" cellpadding="0" cellspacing="0" style="margin:6px 0 18px;">
                  <tr>
                    <td>
                      <a href="https://wa.me/message/CP62RMFFDNZPO1" target="_blank"
                         style="display:inline-block;background:#1c3e5e;color:#fff;text-decoration:none;padding:12px 16px;border-radius:10px;font-weight:600;font-size:14px;">
                        WhatsApp Support
                      </a>
                    </td>
                  </tr>
                </table>

                <p style="margin:0 0 18px 0;color:#374151;font-size:14px;">
                  Thank you,<br/>SPST Logistics Team
                </p>

              </td>
            </tr>

            <tr>
              <td style="padding:16px 24px;background:#f3f4f6;color:#6b7280;font-size:12px;">
                <p style="margin:0;">You are receiving this email because you completed a wine shipment payment with SPST.</p>
              </td>
            </tr>

          </table>
        </td>
      </tr>
    </table>

  </body>
</html>
`;
}

/* -----------------------------------------
   EMAIL CANTINA (ITALIANO) — HTML PREMIUM
------------------------------------------ */
function buildWineryEmail(data: {
  wineryName: string;
  customerEmail: string | undefined;
  bottleCount: string;
  goodsValue: string;
  shipping: string;
  duties: string;
  stripeFee: string;
  total: string;
}): string {
  return `
<!doctype html>
<html lang="it">
  <head>
    <meta charset="utf-8"/>
    <meta name="viewport" content="width=device-width"/>
    <meta name="x-apple-disable-message-reformatting"/>
    <title>Pagamento Ricevuto • Spedizione USA</title>
  </head>
  <body style="margin:0;background:#f6f8fb;font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Arial;">
    
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">
      È stato ricevuto un pagamento per una spedizione USA.
    </div>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f6f8fb;padding:24px 12px;">
      <tr>
        <td align="center">

          <table role="presentation" width="680" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 2px 8px rgba(16,24,40,.06);border:1px solid #e2e8f0;">

            <tr>
              <td style="background:#1c3e5e;padding:18px 24px;">
                <img src="https://cdn.prod.website-files.com/6800cc3b5f399f3e2b7f2ffa/68079e968300482f70a36a4a_output-onlinepngtools%20(1).png" 
                     alt="SPST" style="height:28px;display:block;border:0;filter:brightness(110%);" />
              </td>
            </tr>

            <tr>
              <td style="padding:24px;">
                
                <h1 style="margin:0 0 8px 0;font-size:20px;color:#0f172a;">
                  Pagamento ricevuto
                </h1>

                <p style="margin:0 0 14px 0;color:#374151;font-size:14px;">
                  La spedizione USA è stata pagata correttamente dal cliente <strong>${data.customerEmail || "-"}</strong>.
                </p>

                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" 
                       style="border:1px solid #e5e7eb;border-radius:12px;background:#fff;margin:0 0 18px;">
                  <tr>
                    <td style="padding:12px 14px;font-size:14px;color:#0f172a;">
                      <div><strong>Cantina:</strong> ${data.wineryName}</div>
                      <div><strong>Cliente:</strong> ${data.customerEmail || "-"}</div>
                      <div><strong>Bottiglie:</strong> ${data.bottleCount}</div>
                      <div><strong>Valore merce:</strong> €${formatEuro(data.goodsValue)}</div>
                      <div><strong>Trasporto:</strong> €${formatEuro(data.shipping)}</div>
                      <div><strong>Dazi (15%):</strong> €${formatEuro(data.duties)}</div>
                      <div><strong>Commissioni Stripe:</strong> €${formatEuro(data.stripeFee)}</div>
                      <hr style="border:0;border-top:1px solid #e5e7eb;margin:10px 0;"/>
                      <div style="font-size:15px;font-weight:600;">
                        Totale pagato: €${formatEuro(data.total)}
                      </div>
                    </td>
                  </tr>
                </table>

                <p style="margin:0 0 14px 0;color:#374151;font-size:14px;">
                  Procedi ora con la preparazione della spedizione. Ti invieremo tracking e documenti appena disponibili.
                </p>

                <table role="presentation" cellpadding="0" cellspacing="0" style="margin:6px 0 18px;">
                  <tr>
                    <td>
                      <a href="https://wa.me/message/CP62RMFFDNZPO1" target="_blank"
                         style="display:inline-block;background:#1c3e5e;color:#fff;text-decoration:none;padding:12px 16px;border-radius:10px;font-weight:600;font-size:14px;">
                        Supporto WhatsApp
                      </a>
                    </td>
                  </tr>
                </table>

                <p style="margin:0 0 18px 0;color:#374151;font-size:14px;">
                  Grazie,<br/>Team SPST
                </p>

              </td>
            </tr>

            <tr>
              <td style="padding:16px 24px;background:#f3f4f6;color:#6b7280;font-size:12px;">
                <p style="margin:0;">Ricevi questa email perché hai utilizzato SPST per una spedizione USA.</p>
              </td>
            </tr>

          </table>

        </td>
      </tr>
    </table>
  </body>
</html>
`;
}
