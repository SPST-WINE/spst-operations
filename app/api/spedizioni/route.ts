import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// --- Tipi "soft" per il payload che arriva da nuova/vino ---

type Party = {
  ragioneSociale?: string;
  referente?: string;
  paese?: string;
  citta?: string;
  cap?: string;
  indirizzo?: string;
  telefono?: string;
  piva?: string;
};

type Payload = {
  sorgente?: string;
  tipoSped?: string;
  destAbilitato?: boolean;
  contenuto?: string;
  formato?: string;
  ritiroData?: string;
  ritiroNote?: string;
  mittente?: Party;
  destinatario?: Party;
  incoterm?: string;
  valuta?: string;
  noteFatt?: string;
  fatturazione?: Party;
  fattSameAsDest?: boolean;
  fattDelega?: boolean;
  fatturaFileName?: string | null;
  colli?: any[];
  packingList?: any[];
};

// --- Helper per ID tipo SP-YYYY-MM-DD-XXXXX ---

function makeHumanId(date = new Date()): string {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  const suffix = Math.floor(Math.random() * 100000)
    .toString()
    .padStart(5, "0"); // sempre 5 cifre
  return `SP-${yyyy}-${mm}-${dd}-${suffix}`;
}

// --- Helper colli: volume e peso volumetrico ---

function computePackageMetrics(collo: any) {
  const L = Number(collo?.lunghezza_cm ?? 0);
  const W = Number(collo?.larghezza_cm ?? 0);
  const H = Number(collo?.altezza_cm ?? 0);
  const weight = Number(collo?.peso_kg ?? 0);

  const validDims = L > 0 && W > 0 && H > 0;
  const volume_cm3 = validDims ? L * W * H : null;
  const volumetric_divisor = 5000;
  const weight_vol_kg = volume_cm3 ? volume_cm3 / volumetric_divisor : null;
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
    volumetric_divisor,
  };
}

// --- Supabase client lazy (non esplode in build se mancano le env) ---

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE;

  if (!url || !key) {
    console.warn("[API/spedizioni] Supabase env mancanti, skip scrittura DB:", {
      url: !!url,
      key: !!key,
    });
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

// --- GET /api/spedizioni (per ora stub) ---

export async function GET() {
  return NextResponse.json(
    {
      ok: true,
      message: "Endpoint spedizioni (GET) non ancora implementato.",
      data: [],
    },
    { status: 200 }
  );
}

// --- POST /api/spedizioni ---
// Crea spedizione in spst.shipments + spst.packages

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as Payload;
  const id_human = makeHumanId();

  const supabaseAdmin = getSupabaseAdmin();

  // Se non abbiamo le env su Vercel, non tocchiamo il DB ma lasciamo funzionare la UI
  if (!supabaseAdmin) {
    return NextResponse.json(
      {
        ok: true,
        id: id_human,
        recId: id_human,
        db: "skipped (no SUPABASE_SERVICE_ROLE_KEY / URL)",
      },
      { status: 201 }
    );
  }

  try {
    const mitt = body.mittente || {};
    const dest = body.destinatario || {};

    // giorno_ritiro: prendiamo solo la parte data (YYYY-MM-DD)
    const giorno_ritiro =
      body.ritiroData && !Number.isNaN(Date.parse(body.ritiroData))
        ? new Date(body.ritiroData).toISOString().slice(0, 10)
        : null;

    const colli = Array.isArray(body.colli) ? body.colli : [];
    const colli_n = colli.length || null;
    const peso_reale_kg =
      colli.reduce(
        (sum, c) => sum + (Number(c?.peso_kg ?? 0) || 0),
        0
      ) || null;

    // 1) INSERT su spst.shipments
    const { data: shipmentRow, error: shipErr } = await supabaseAdmin
      .from("shipments")
      .insert({
        human_id: id_human,
        tipo_spedizione: body.tipoSped ?? null,
        incoterm: body.incoterm ?? null,
        incoterm_norm: body.incoterm ?? null,
        dest_abilitato_import: body.destAbilitato ?? null,
        note_ritiro: body.ritiroNote ?? null,
        giorno_ritiro,
        mittente_paese: mitt.paese ?? null,
        mittente_citta: mitt.citta ?? null,
        mittente_cap: mitt.cap ?? null,
        mittente_indirizzo: mitt.indirizzo ?? null,
        dest_paese: dest.paese ?? null,
        dest_citta: dest.citta ?? null,
        dest_cap: dest.cap ?? null,
        colli_n,
        peso_reale_kg,
        -- niente "fields": usiamo il default '{}'::jsonb
      } as any)
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

    const shipmentId = (shipmentRow as any).id as string;

    // 2) INSERT su spst.packages (uno per ogni collo)
    if (colli.length > 0) {
      const rows = colli.map((c: any) => {
        const m = computePackageMetrics(c);
        return {
          shipment_id: shipmentId,
          ...m,
        };
      });

      const { error: pkgErr } = await supabaseAdmin
        .from("packages")
        .insert(rows);

      if (pkgErr) {
        console.error("[API/spedizioni] insert packages error:", pkgErr);
        return NextResponse.json(
          {
            ok: false,
            id: id_human,
            recId: id_human,
            shipment_id: shipmentId,
            error: "DB_INSERT_PACKAGES_FAILED",
            details: pkgErr.message ?? pkgErr,
          },
          { status: 500 }
        );
      }
    }

    // Risposta per la UI
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
