import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

// Middleware disattivato: lascia passare tutto.
// Quando avremo completato Supabase Auth + RLS, potremo riattivare la protezione qui.
export function middleware(_req: NextRequest) {
  return NextResponse.next();
}

// Matcher vuoto = il middleware NON gira su nessuna route.
export const config = {
  matcher: [] as string[],
};
