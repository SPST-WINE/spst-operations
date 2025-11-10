import { NextResponse } from "next/server";

// Helper per ID tipo SP-DD-MM-XXXXX
function makeHumanId(date = new Date()): string {
  const dd = String(date.getDate()).padStart(2, "0");
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const suffix = Math.floor(Math.random() * 100000)
    .toString()
    .padStart(5, "0"); // sempre 5 cifre
  return `SP-${dd}-${mm}-${suffix}`;
}

// GET /api/spedizioni
export async function GET() {
  // TODO: in futuro leggeremo le spedizioni vere da Supabase
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

  // Qui in futuro: insert su Supabase (spst.shipments + spst.packages)
  const id = makeHumanId();

  return NextResponse.json(
    {
      ok: true,
      id,        // usato dalla pagina nuova/vino come idSped
      recId: id, // alias, così non rompiamo niente se in futuro cambiamo
      received: body,
    },
    { status: 201 }
  );
}
