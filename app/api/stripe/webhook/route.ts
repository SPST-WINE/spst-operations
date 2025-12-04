// app/api/stripe/webhook/route.ts
import { headers } from "next/headers";
import Stripe from "stripe";
import { NextRequest } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";
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
  } else {
    // puoi aggiungere altri tipi in futuro
  }

  return new Response("ok", { status: 200 });
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  try {
    const metadata = session.metadata || {};
    const dutiesPaymentId = metadata.duties_payment_id;

    if (!dutiesPaymentId) {
      console.warn("[webhook] missing duties_payment_id");
      return;
    }

    const supa = createSupabaseServer();

    const { data: payment, error: fetchErr } = await supa
      .from("usa_duties_payments")
      .select("*")
      .eq("id", dutiesPaymentId)
      .maybeSingle();

    if (fetchErr || !payment) {
      console.error("[webhook] payment not found", fetchErr);
      return;
    }

    // aggiorna stato
    const { error: updateErr } = await supa
      .from("usa_duties_payments")
      .update({
        status: "paid",
        paid_at: new Date().toISOString(),
        stripe_payment_intent_id:
          typeof session.payment_intent === "string"
            ? session.payment_intent
            : session.payment_intent?.id ?? null,
      })
      .eq("id", dutiesPaymentId);

    if (updateErr) {
      console.error("[webhook] update error", updateErr);
    }

    const fromEmail = process.env.DUTIES_FROM_EMAIL || "no-reply@spst.it";

    // Mail al cliente (inglese)
    await resend.emails.send({
      from: `SPST <${fromEmail}>`,
      to: payment.customer_email,
      subject: "Your wine shipping & duties payment has been received",
      html: buildCustomerEmail(payment),
    });

    // Mail alla cantina (italiano)
    await resend.emails.send({
      from: `SPST <${fromEmail}>`,
      to: payment.winery_email,
      subject:
        "Pagamento trasporto + dazi confermato per il tuo cliente USA",
      html: buildWineryEmail(payment),
    });
  } catch (err) {
    console.error("[webhook handleCheckoutCompleted] error", err);
  }
}

function formatEuro(n: number | string): string {
  const num = typeof n === "number" ? n : Number(n);
  if (!Number.isFinite(num)) return "0,00";
  return num.toFixed(2).replace(".", ",");
}

// EMAIL CLIENTE (inglese)
function buildCustomerEmail(payment: any): string {
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
          <td style="padding: 4px 0; text-align: right;">${payment.winery_name}</td>
        </tr>
        <tr>
          <td style="padding: 4px 0; color: #555;">Bottles</td>
          <td style="padding: 4px 0; text-align: right;">${payment.bottle_count}</td>
        </tr>
        <tr>
          <td style="padding: 4px 0; color: #555;">Declared goods value</td>
          <td style="padding: 4px 0; text-align: right;">€ ${formatEuro(payment.goods_value_eur)}</td>
        </tr>
        <tr>
          <td style="padding: 4px 0; color: #555;">Shipping</td>
          <td style="padding: 4px 0; text-align: right;">€ ${formatEuro(payment.shipping_eur)}</td>
        </tr>
        <tr>
          <td style="padding: 4px 0; color: #555;">Duties (15%)</td>
          <td style="padding: 4px 0; text-align: right;">€ ${formatEuro(payment.duties_eur)}</td>
        </tr>
        <tr>
          <td style="padding: 4px 0; color: #555;">Stripe fees (included in total)</td>
          <td style="padding: 4px 0; text-align: right;">€ ${formatEuro(payment.stripe_fee_eur)}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; border-top: 1px solid #ddd; font-weight: 600;">Total paid</td>
          <td style="padding: 8px 0; border-top: 1px solid #ddd; text-align: right; font-weight: 600;">€ ${formatEuro(payment.total_charge_eur)}</td>
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
function buildWineryEmail(payment: any): string {
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
          <td style="padding: 4px 0; text-align: right;">${payment.customer_email}</td>
        </tr>
        <tr>
          <td style="padding: 4px 0; color: #555;">Bottiglie (equivalenti)</td>
          <td style="padding: 4px 0; text-align: right;">${payment.bottle_count}</td>
        </tr>
        <tr>
          <td style="padding: 4px 0; color: #555;">Valore merce dichiarato</td>
          <td style="padding: 4px 0; text-align: right;">€ ${formatEuro(payment.goods_value_eur)}</td>
        </tr>
        <tr>
          <td style="padding: 4px 0; color: #555;">Trasporto</td>
          <td style="padding: 4px 0; text-align: right;">€ ${formatEuro(payment.shipping_eur)}</td>
        </tr>
        <tr>
          <td style="padding: 4px 0; color: #555;">Dazi (15%)</td>
          <td style="padding: 4px 0; text-align: right;">€ ${formatEuro(payment.duties_eur)}</td>
        </tr>
        <tr>
          <td style="padding: 4px 0; color: #555;">Fee Stripe (incluse nel totale)</td>
          <td style="padding: 4px 0; text-align: right;">€ ${formatEuro(payment.stripe_fee_eur)}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; border-top: 1px solid #ddd; font-weight: 600;">Totale pagato dal cliente</td>
          <td style="padding: 8px 0; border-top: 1px solid #ddd; text-align: right; font-weight: 600;">€ ${formatEuro(payment.total_charge_eur)}</td>
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
