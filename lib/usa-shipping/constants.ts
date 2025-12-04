// lib/usa-shipping/constants.ts

export const SHIPPING_TABLE: Record<number, number> = {
  6: 119,
  12: 179,
  18: 299,
  24: 369,
  30: 439,
  36: 489,
  42: 549,
  48: 629,
  54: 719,
  60: 799,
};

// 15% sul valore merce
export const DUTIES_RATE = 0.15;

// Stripe fee: 0,25€ + 3,25%
export const STRIPE_PERCENT = 0.0325;
export const STRIPE_FIXED = 0.25;
