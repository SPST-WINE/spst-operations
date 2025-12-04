// app/api/usa-shipping-pay/create-checkout/route.ts
import Stripe from "stripe";
import { NextRequest } from "next/server";
import { computeTotals, getShippingForBottleCount } from "@/lib/usa-shipping/calc";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2024-06-20", // usa la versione che hai in account
});

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL!;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const wineryName = String(body.wineryName || "").trim();
    const wineryEmail = String(body.wineryEmail || "").trim();
    const customerEmail = String(body.customerEmail || "").trim();
    const bottleCount = Number(body.bottleCount);
    const goodsValue = Number(body.goodsValue);

    if (!wineryName || !wineryEmail || !customerEmail) {
      return new Response("Missing wineryName / wineryEmail / customerEmail", {
        status: 400,
      });
    }

    if (!bottleCount || !getShippingForBottleCount(bottleCount)) {
      return new Response("Invalid bottleCount", { status: 400 });
    }

    if (!Number.isFinite(goodsValue) || goodsValue < 0) {
      return new Response("Invalid goodsValue", { status: 400 });
    }

    const breakdown = computeTotals(bottleCount, goodsValue);

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      customer_email: customerEmail,
      shipping_address_collection: {
        allowed_countries: ["US"],
      },
      phone_number_collection: {
        enabled: true,
      },
      line_items: [
        {
          price_data: {
            currency: "eur",
            unit_amount: Math.round(breakdown.total * 100), // centesimi
            product_data: {
              name: "US Shipping & Duties",
              description: `${wineryName} – ${bottleCount} bottles, goods value €${goodsValue.toFixed(
                2
              )}`,
            },
          },
          quantity: 1,
        },
      ],
      metadata: {
        type: "usa_shipping_pay",
        winery_name: wineryName,
        winery_email: wineryEmail,
        customer_email: customerEmail,
        bottle_count: String(bottleCount),
        goods_value: goodsValue.toFixed(2),
        shipping: breakdown.shipping.toFixed(2),
        duties: breakdown.duties.toFixed(2),
        base_charge: breakdown.baseCharge.toFixed(2),
        stripe_fee: breakdown.stripeFee.toFixed(2),
        total: breakdown.total.toFixed(2),
      },
      success_url: `${BASE_URL}/usa-shipping-pay/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${BASE_URL}/usa-shipping-pay/cancel`,
    });

    return Response.json({ url: session.url });
  } catch (err) {
    console.error("[usa-shipping-pay/create-checkout] Error:", err);
    return new Response("Error creating checkout", { status: 500 });
  }
}
