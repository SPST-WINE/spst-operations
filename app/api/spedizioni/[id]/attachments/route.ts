import { NextResponse } from "next/server";

type Params = { params: { id: string } };

// GET /api/spedizioni/[id]/attachments
export async function GET(_req: Request, { params }: Params) {
  const { id } = params;

  return NextResponse.json(
    {
      ok: true,
      message: `Lista allegati per spedizione ${id} non ancora migrata.`,
      attachments: [],
    },
    { status: 200 }
  );
}

// POST /api/spedizioni/[id]/attachments
export async function POST(_req: Request, { params }: Params) {
  const { id } = params;

  return NextResponse.json(
    {
      ok: true,
      message: `Upload allegato per spedizione ${id} non ancora implementato.`,
    },
    { status: 200 }
  );
}
