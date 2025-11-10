// app/api/quotazioni/route.ts
// Stub temporaneo: rimuove dipendenza da Firebase Admin.
// In futuro lo rifaremo parlando con Supabase o con un servizio esterno.

import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));

    // qui potresti loggare o inviare email con RESEND, ma per ora rispondiamo "ok"
    return NextResponse.json(
      {
        ok: true,
        message: "Endpoint quotazioni non ancora migrato. Usa area riservata o contatta SPST.",
        received: body,
      },
      { status: 200 }
    );
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: "Errore interno quotazioni" },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json(
    { ok: true, message: "Endpoint quotazioni attivo ma non implementato (no Firebase)." },
    { status: 200 }
  );
}
