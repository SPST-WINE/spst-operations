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
      line_items: [
        {
          price_data: {
            currency: "eur",
            unit_amount: Math.round(Number(amount) * 100),
            product_data: {
              name: "US Customs Duties",
              description: description || `Duties for shipment ${shipmentId || ""}`,
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
