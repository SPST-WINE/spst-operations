import { NextResponse } from "next/server";

// GET /api/profile
export async function GET() {
  // In futuro recupereremo i dati profilo da Supabase (tabella accounts / users).
  return NextResponse.json(
    {
      ok: true,
      profile: {
        email: "info@spst.it",
        name: "SPST Admin",
      },
    },
    { status: 200 }
  );
}
