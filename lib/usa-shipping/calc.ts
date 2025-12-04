// lib/usa-shipping/calc.ts
import { SHIPPING_TABLE, DUTIES_RATE, STRIPE_PERCENT, STRIPE_FIXED } from "./constants";

export function getShippingForBottleCount(bottleCount: number): number {
  const value = SHIPPING_TABLE[bottleCount];
  if (!value) {
    throw new Error(`Unsupported bottle_count ${bottleCount}`);
  }
  return value;
}

/**
 * Calcolo:
 * - shipping: da tabella
 * - duties: 15% valore merce
 * - baseCharge = shipping + duties
 * - stripe total: gross-up per avere baseCharge netto dopo fee
 *
 * X = totalCharge
 * FeeStripe = X*STRIPE_PERCENT + STRIPE_FIXED
 * Net = X - FeeStripe = X*(1-STRIPE_PERCENT) - STRIPE_FIXED
 * Vogliamo Net ≈ baseCharge
 * => X = (baseCharge + STRIPE_FIXED) / (1 - STRIPE_PERCENT)
 */
export function computeTotals(bottleCount: number, goodsValue: number) {
  const shipping = getShippingForBottleCount(bottleCount);
  const duties = goodsValue * DUTIES_RATE;
  const baseCharge = shipping + duties;

  const rawTotal = (baseCharge + STRIPE_FIXED) / (1 - STRIPE_PERCENT);
  const total = Math.round(rawTotal * 100) / 100; // 2 decimali

  const stripeFee = total - baseCharge;

  return {
    shipping,
    duties,
    baseCharge,
    stripeFee,
    total,
  };
}
