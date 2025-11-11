import { NextResponse } from "next/server";
import { Pool } from "pg";

type ShipmentRow = {
  id: string;
  human_id: string | null;
  tipo_spedizione: string | null;
  incoterm: string | null;
  mittente_citta: string | null;
  dest_citta: string | null;
  giorno_ritiro: string | null;
  colli_n: number | null;
  peso_reale_kg: string | number | null;
  created_at: string;
};

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.warn("[API/my-shipments] DATABASE_URL non configurata");
}

const pool = connectionString ? new Pool({ connectionString }) : null;

// GET /api/my-shipments
export async function GET() {
  if (!pool) {
    return NextResponse.json(
      {
        ok: false,
        error: "NO_DATABASE_URL",
      },
      { status: 500 }
    );
  }

  let client: any;
  try {
    client = await pool.connect();

    const result = await client.query<ShipmentRow>(
      `
      select
        id,
        human_id,
        tipo_spedizione,
        incoterm,
        mittente_citta,
        dest_citta,
        giorno_ritiro,
        colli_n,
        peso_reale_kg,
        created_at
      from spst.shipments
      order by created_at desc
      limit 50
      `
    );

    return NextResponse.json(
      {
        ok: true,
        data: result.rows,
      },
      { status: 200 }
    );
  } catch (e: any) {
    console.error("[API/my-shipments] unexpected error:", e);
    return NextResponse.json(
      {
        ok: false,
        error: "DB_SELECT_FAILED",
        details: e?.message ?? String(e),
      },
      { status: 500 }
    );
  } finally {
    if (client) client.release();
  }
}
