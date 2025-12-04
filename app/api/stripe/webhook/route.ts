// app/api/stripe/webhook/route.ts
import { headers } from "next/headers";
import Stripe from "stripe";
import { NextRequest } from "next/server";
import { Resend } from "resend";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2024-06-20",
});

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

    // Mail al cliente (inglese)
    if (customerEmail) {
      await resend.emails.send({
        from: `SPST <${fromEmail}>`,
        to: customerEmail,
        subject: "Your wine shipping & duties payment has been received",
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

    // Mail alla cantina (italiano)
    if (wineryEmail) {
      await resend.emails.send({
        from: `SPST <${fromEmail}>`,
        to: wineryEmail,
        subject:
          "Pagamento trasporto + dazi confermato per il tuo cliente USA",
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

// EMAIL CLIENTE (inglese)
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
  <div style="font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto; padding: 16px;">
    <h2 style="margin-bottom: 8px;">Thank you for your payment</h2>
    <p style="margin-top: 0; color: #555;">
      We have received your payment for wine shipping and customs duties to the United States.
    </p>

    <h3 style="margin-top: 24px;">Summary</h3>
    <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
      <tbody>
        <tr>
          <td style="padding: 4px 0; color: #555;">Winery</td>
          <td style="padding: 4px 0; text-align: right;">${data.wineryName}</td>
        </tr>
        <tr>
          <td style="padding: 4px 0; color: #555;">Bottles</td>
          <td style="padding: 4px 0; text-align: right;">${data.bottleCount}</td>
        </tr>
        <tr>
          <td style="padding: 4px 0; color: #555;">Declared goods value</td>
          <td style="padding: 4px 0; text-align: right;">€ ${formatEuro(
            data.goodsValue
          )}</td>
        </tr>
        <tr>
          <td style="padding: 4px 0; color: #555;">Shipping</td>
          <td style="padding: 4px 0; text-align: right;">€ ${formatEuro(
            data.shipping
          )}</td>
        </tr>
        <tr>
          <td style="padding: 4px 0; color: #555;">Duties (15%)</td>
          <td style="padding: 4px 0; text-align: right;">€ ${formatEuro(
            data.duties
          )}</td>
        </tr>
        <tr>
          <td style="padding: 4px 0; color: #555;">Stripe fees (included in total)</td>
          <td style="padding: 4px 0; text-align: right;">€ ${formatEuro(
            data.stripeFee
          )}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; border-top: 1px solid #ddd; font-weight: 600;">Total paid</td>
          <td style="padding: 8px 0; border-top: 1px solid #ddd; text-align: right; font-weight: 600;">€ ${formatEuro(
            data.total
          )}</td>
        </tr>
      </tbody>
    </table>

    <p style="margin-top: 24px; color: #555;">
      The winery will now process your order together with SPST and arrange the shipment to your US address.
    </p>

    <p style="margin-top: 16px; color: #777; font-size: 12px;">
      If you have any questions, please contact the winery directly or reply to this email.
    </p>
  </div>
  `;
}

// EMAIL CANTINA (italiano)
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
  <div style="font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto; padding: 16px;">
    <h2 style="margin-bottom: 8px;">Pagamento trasporto + dazi confermato</h2>
    <p style="margin-top: 0; color: #555;">
      Il tuo cliente ha completato il pagamento per trasporto e dazi della spedizione verso gli USA.
    </p>

    <h3 style="margin-top: 24px;">Dettaglio pagamento</h3>
    <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
      <tbody>
        <tr>
          <td style="padding: 4px 0; color: #555;">Email cliente</td>
          <td style="padding: 4px 0; text-align: right;">${
            data.customerEmail || "-"
          }</td>
        </tr>
        <tr>
          <td style="padding: 4px 0; color: #555;">Bottiglie (equivalenti)</td>
          <td style="padding: 4px 0; text-align: right;">${data.bottleCount}</td>
        </tr>
        <tr>
          <td style="padding: 4px 0; color: #555;">Valore merce dichiarato</td>
          <td style="padding: 4px 0; text-align: right;">€ ${formatEuro(
            data.goodsValue
          )}</td>
        </tr>
        <tr>
          <td style="padding: 4px 0; color: #555;">Trasporto</td>
          <td style="padding: 4px 0; text-align: right;">€ ${formatEuro(
            data.shipping
          )}</td>
        </tr>
        <tr>
          <td style="padding: 4px 0; color: #555;">Dazi (15%)</td>
          <td style="padding: 4px 0; text-align: right;">€ ${formatEuro(
            data.duties
          )}</td>
        </tr>
        <tr>
          <td style="padding: 4px 0; color: #555;">Fee Stripe (incluse nel totale)</td>
          <td style="padding: 4px 0; text-align: right;">€ ${formatEuro(
            data.stripeFee
          )}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; border-top: 1px solid #ddd; font-weight: 600;">Totale pagato dal cliente</td>
          <td style="padding: 8px 0; border-top: 1px solid #ddd; text-align: right; font-weight: 600;">€ ${formatEuro(
            data.total
          )}</td>
        </tr>
      </tbody>
    </table>

    <p style="margin-top: 24px; color: #555;">
      Puoi ora procedere con la preparazione e spedizione dell'ordine verso gli USA. Per qualsiasi supporto operativo sulle spedizioni, siamo a disposizione tramite SPST.
    </p>

    <p style="margin-top: 16px; color: #777; font-size: 12px;">
      Questo messaggio è stato generato automaticamente dal sistema SPST per la gestione dei pagamenti trasporto + dazi verso gli Stati Uniti.
    </p>
  </div>
  `;
}
