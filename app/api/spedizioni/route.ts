import { NextResponse } from "next/server";

// Helper per ID tipo SP-YYYY-MM-DD-XXXXX
function makeHumanId(date = new Date()): string {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  const suffix = Math.floor(Math.random() * 100000)
    .toString()
    .padStart(5, "0"); // sempre 5 cifre
  return `SP-${yyyy}-${mm}-${dd}-${suffix}`;
}

// GET /api/spedizioni
export async function GET() {
  // TODO: in futuro leggeremo le spedizioni vere da Supabase (vista v_shipments_basic)
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
  const id_human = makeHumanId();

  // Per ora NON scriviamo sul DB: generiamo solo l'ID
  return NextResponse.json(
    {
      ok: true,
      id: id_human,    // usato come ID Spedizione
      recId: id_human, // alias
      received: body,  // payload, utile per debug finché non attacchiamo Supabase
    },
    { status: 201 }
  );
}
