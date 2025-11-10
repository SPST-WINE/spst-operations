import { NextResponse } from "next/server";

// GET /api/spedizioni
export async function GET() {
  // In futuro qui potremo leggere le spedizioni da Supabase.
  return NextResponse.json(
    {
      ok: true,
      message: "Endpoint spedizioni non ancora migrato (no Firebase).",
      data: [],
    },
    { status: 200 }
  );
}

// POST /api/spedizioni
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));

  // In futuro: creazione spedizione in Supabase.
  return NextResponse.json(
    {
      ok: true,
      message: "Creazione spedizione non ancora implementata (no Firebase).",
      received: body,
    },
    { status: 200 }
  );
}
