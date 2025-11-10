import { NextResponse } from "next/server";

type Params = { params: { id: string } };

// POST /api/spedizioni/[id]/notify
export async function POST(_req: Request, { params }: Params) {
  const { id } = params;

  // In futuro: invio email / notifiche
  return NextResponse.json(
    {
      ok: true,
      message: `Notifica spedizione ${id} non ancora implementata (no Firebase).`,
    },
    { status: 200 }
  );
}
