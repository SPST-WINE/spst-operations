// app/api/session/route.ts
// Stub temporaneo: non usa più Firebase Admin.
// Serve solo a non far esplodere la build e a dare una risposta neutra.

import { NextResponse } from "next/server";

export async function GET() {
  // In futuro qui potremo leggere la sessione Supabase lato server.
  return NextResponse.json({
    authenticated: false,
    user: null,
  });
}
