import { NextResponse } from "next/server";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

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

// calcolo volume e peso volumetrico (L*W*H in cm, divisore 5000)
function computePackageMetrics(collo: any) {
  const L = Number(collo?.lunghezza_cm ?? 0);
  const W = Number(collo?.larghezza_cm ?? 0);
  const H = Number(collo?.altezza_cm ?? 0);
  const weight = Number(collo?.peso_kg ?? 0);

  const validDims = L > 0 && W > 0 && H > 0;
  const volume_cm3 = validDims ? L * W * H : null;
  const weight_vol_kg = volume_cm3 ? volume_cm3 / 5000 : null; // classica formula courier
  const weight_tariff_kg =
    weight_vol_kg != null ? Math.max(weight, weight_vol_kg) : weight || null;

  return {
    length_cm: validDims ? L : null,
    width_cm: validDims ? W : null,
    height_cm: validDims ? H : null,
    weight_kg: weight || null,
    volume_cm3,
    weight_volumetric_kg: weight_vol_kg,
    weight_tariff_kg,
  };
}

// Lazy client: lo creiamo solo quando serve, e solo se le env ci sono
function getSupabaseAdmin(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    console.warn(
      "[API/spedizioni] Supabase env mancanti, skip scrittura DB:",
      { url: !!url, key: !!key }
    );
    return null;
  }

  return createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    db: {
      schema: "spst",
    },
  });
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

  const supabaseAdmin = getSupabaseAdmin();

  // Se non abbiamo la service key, non proviamo nemmeno a scrivere sul DB
  if (!supabaseAdmin) {
    return NextResponse.json(
      {
        ok: true,
        id: id_human,
        recId: id_human,
        db: "skipped (no SUPABASE_SERVICE_ROLE_KEY or URL)",
      },
      { status: 201 }
    );
  }

  try {
    // ------------------------------------------------------------
    // 1) Inserisci spedizione su spst.shipments
    //    Per ora salviamo campo human_id + un JSON "payload_raw"
    // ------------------------------------------------------------
    const { data: shipmentRow, error: shipErr } = await supabaseAdmin
      .from("shipments")
      .insert({
        human_id: id_human, // <— deve esistere in spst.shipments (text)
        source: (body as any)?.sorgente ?? "vino",
        shipment_type: (body as any)?.tipoSped ?? null,
        incoterm: (body as any)?.incoterm ?? null,
        currency: (body as any)?.valuta ?? null,
        payload_raw: body, // jsonb per debug/migrazione
      })
      .select("*")
      .single();

    if (shipErr) {
      console.error("[API/spedizioni] insert shipments error:", shipErr);
      return NextResponse.json(
        {
          ok: false,
          id: id_human,
          recId: id_human,
          error: "DB_INSERT_SHIPMENT_FAILED",
          details: shipErr.message ?? shipErr,
        },
        { status: 500 }
      );
    }

    const shipmentId = (shipmentRow as any).id;

    // ------------------------------------------------------------
    // 2) Inserisci colli su spst.packages
    // ------------------------------------------------------------
    const colli = Array.isArray((body as any)?.colli)
      ? ((body as any).colli as any[])
      : [];

    if (colli.length > 0) {
      const rows = colli.map((c: any, idx: number) => {
        const metrics = computePackageMetrics(c);
        return {
          shipment_id: shipmentId,
          index: idx + 1, // se non hai questa colonna, rimuoviamola
          ...metrics,
        };
      });

      const { error: pkgErr } = await supabaseAdmin.from("packages").insert(rows);

      if (pkgErr) {
        console.error("[API/spedizioni] insert packages error:", pkgErr);
        return NextResponse.json(
          {
            ok: false,
            id: id_human,
            recId: id_human,
            error: "DB_INSERT_PACKAGES_FAILED",
            details: pkgErr.message ?? pkgErr,
          },
          { status: 500 }
        );
      }
    }

    return NextResponse.json(
      {
        ok: true,
        id: id_human,
        recId: id_human,
        shipment_id: shipmentId,
      },
      { status: 201 }
    );
  } catch (e: any) {
    console.error("[API/spedizioni] unexpected error:", e);
    return NextResponse.json(
      {
        ok: false,
        id: id_human,
        recId: id_human,
        error: "UNEXPECTED_ERROR",
        details: e?.message ?? String(e),
      },
      { status: 500 }
    );
  }
}
