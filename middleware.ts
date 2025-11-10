import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

// Middleware attualmente disattivato: lascia passare tutto.
// Quando Supabase Auth + RLS saranno pronti, lo riattiviamo.
export function middleware(_req: NextRequest) {
  return NextResponse.next();
}

export const config = {
  matcher: [], // niente TypeScript qui, deve essere plain JS
};
