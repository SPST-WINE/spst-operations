import { NextResponse } from "next/server";

// GET /api/spedizioni
export async function GET() {
  return NextResponse.json(
    {
      ok: true,
      message: "Endpoint spedizioni in fase di migrazione. Dati non ancora letti dal DB.",
      data: [],
    },
    { status: 200 }
  );
}

// POST /api/spedizioni
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));

  // TODO: qui collegheremo Supabase (spst.shipments + spst.packages).
  console.log("[SPEDIZIONE/NUOVA] payload ricevuto", body);

  const id = `SPST-${Date.now().toString(36)}`;

  return NextResponse.json(
    {
      ok: true,
      id,
    },
    { status: 200 }
  );
}
