// app/api/quote-requests/[id]/options/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireStaff } from "@/lib/auth/requireStaff";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

function makeSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    console.error("[API/quote-requests/:id/options] Missing Supabase env", {
      hasUrl: !!url,
      hasKey: !!key,
    });
    return null;
  }

  return createClient(url, key, {
    auth: { persistSession: false },
    db: { schema: "spst" },
  });
}

function jsonError(
  status: number,
  error: string,
  extra?: Record<string, any>
) {
  return NextResponse.json(
    {
      ok: false,
      error,
      ...(extra || {}),
    },
    { status }
  );
}

type OptionRow = {
  id: string;
  quote_id: string;
  label: string | null;
  carrier: string | null;
  service_name: string | null;
  transit_time: string | null;
  freight_price: number | null;
  customs_price: number | null;
  total_price: number | null;
  currency: string | null;
  public_notes: string | null;
  internal_cost: number | null;
  internal_profit: number | null;
  status: string | null;
  show_vat: boolean | null;
  vat_rate: number | null;
  sent_at: string | null;
  created_at: string | null;
};

type OptionCreatePayload = {
  label?: string | null;
  carrier?: string | null;
  service_name?: string | null;
  transit_time?: string | null;
  freight_price?: number | null;
  customs_price?: number | null;
  total_price?: number | null;
  currency?: string | null;
  public_notes?: string | null;
  internal_cost?: number | null;
  internal_profit?: number | null;
  visible_to_client?: boolean;
  status?: string | null;
  show_vat?: boolean;
  vat_rate?: number | null;
};

// ---------------- GET ----------------

export async function GET(
  _req: NextRequest,
  context: { params: { id: string } }
) {
  const staff = await requireStaff();
  if ("response" in staff) return staff.response;

  const { id } = context.params;
  if (!id) return jsonError(400, "MISSING_QUOTE_ID");

  const supabase = makeSupabase();
  if (!supabase) return jsonError(500, "NO_SUPABASE_CONFIG");

  try {
    const { data, error } = await supabase
      .from("quote_options")
      .select(
        [
          "id",
          "quote_id",
          "label",
          "carrier",
          "service_name",
          "transit_time",
          "freight_price",
          "customs_price",
          "total_price",
          "currency",
          "public_notes",
          "internal_cost",
          "internal_profit",
          "status",
          "show_vat",
          "vat_rate",
          "sent_at",
          "created_at",
        ].join(", ")
      )
      .eq("quote_id", id)
      .order("created_at", { ascending: true });

    if (error) {
      console.error(
        "[API/quote-requests/:id/options:GET] DB error",
        error.message
      );
      return jsonError(500, "DB_ERROR", { message: error.message });
    }

    return NextResponse.json(
      {
        ok: true,
        options: (data || []) as unknown as OptionRow[],
      },
      { status: 200 }
    );
  } catch (e: any) {
    console.error(
      "[API/quote-requests/:id/options:GET] ERROR",
      e?.message || e
    );
    return jsonError(500, "SERVER_ERROR", { message: e?.message });
  }
}

// ---------------- POST ----------------

export async function POST(
  req: NextRequest,
  context: { params: { id: string } }
) {
  const staff = await requireStaff();
  if ("response" in staff) return staff.response;

  const { id } = context.params;
  if (!id) return jsonError(400, "MISSING_QUOTE_ID");

  const supabase = makeSupabase();
  if (!supabase) return jsonError(500, "NO_SUPABASE_CONFIG");

  let body: OptionCreatePayload;
  try {
    body = (await req.json()) as OptionCreatePayload;
  } catch (e: any) {
    console.error(
      "[API/quote-requests/:id/options:POST] invalid json",
      e?.message || e
    );
    return jsonError(400, "INVALID_JSON");
  }

  const now = new Date().toISOString();

  const insertObj: Record<string, any> = {
    quote_id: id,
    label: body.label ?? null,
    carrier: body.carrier ?? null,
    service_name: body.service_name ?? null,
    transit_time: body.transit_time ?? null,
    freight_price: body.freight_price ?? null,
    customs_price: body.customs_price ?? null,
    total_price: body.total_price ?? null,
    currency: body.currency || "EUR",
    public_notes: body.public_notes ?? null,
    internal_cost: body.internal_cost ?? null,
    internal_profit: body.internal_profit ?? null,
    visible_to_client: body.visible_to_client ?? true,
    status: body.status || "bozza",
    show_vat: body.show_vat ?? false,
    vat_rate: body.vat_rate ?? null,
    created_at: now,
    updated_at: now,
  };

  try {
    const { data, error } = await supabase
      .from("quote_options")
      .insert(insertObj)
      .select(
        [
          "id",
          "quote_id",
          "label",
          "carrier",
          "service_name",
          "transit_time",
          "freight_price",
          "customs_price",
          "total_price",
          "currency",
          "public_notes",
          "internal_cost",
          "internal_profit",
          "status",
          "show_vat",
          "vat_rate",
          "sent_at",
          "created_at",
        ].join(", ")
      )
      .single();

    if (error) {
      console.error(
        "[API/quote-requests/:id/options:POST] DB error",
        error.message
      );
      return jsonError(500, "DB_ERROR", { message: error.message });
    }

    return NextResponse.json(
      {
        ok: true,
        option: data as unknown as OptionRow,
      },
      { status: 201 }
    );
  } catch (e: any) {
    console.error(
      "[API/quote-requests/:id/options:POST] ERROR",
      e?.message || e
    );
    return jsonError(500, "SERVER_ERROR", { message: e?.message });
  }
}
