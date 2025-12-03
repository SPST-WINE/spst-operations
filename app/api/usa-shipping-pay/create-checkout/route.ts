// app/api/usa-shipping-pay/create-checkout/route.ts

import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export async function POST(req: Request) {
  try {
    const { amount, customerEmail, description, shipmentId } = await req.json();

    if (!amount || !customerEmail) {
      return new Response("Missing fields", { status: 400 });
    }

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      customer_email: customerEmail,

      // 👇 Richiesta dati di spedizione + telefono
      shipping_address_collection: {
        allowed_countries: ["US"], // aggiungi altri paesi se ti servono
      },
      phone_number_collection: {
        enabled: true,
      },
      // opzionale se vuoi anche indirizzo di fatturazione obbligatorio
      // billing_address_collection: "required",

      line_items: [
        {
          price_data: {
            currency: "eur",
            unit_amount: Math.round(Number(amount) * 100),
            product_data: {
              name: "US Wine Shipping",
              description:
                description || `Taxes, Duties and Excise included. Door-to-door US Shipment for winery ${shipmentId || ""}`,
            },
          },
          quantity: 1,
        },
      ],
      metadata: {
        type: "duties",
        shipmentId: shipmentId ?? "",
        baseAmount: String(amount),
      },
      success_url: `${process.env.NEXT_PUBLIC_BASE_URL}/usa-shipping-pay/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.NEXT_PUBLIC_BASE_URL}/usa-shipping-pay/cancel`,
    });

    return Response.json({ url: session.url });
  } catch (err) {
    console.error(err);
    return new Response("Error creating checkout", { status: 500 });
  }
}
