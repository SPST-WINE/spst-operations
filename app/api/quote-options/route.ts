// app/api/quote-options/route.ts
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
    console.error("[API/quote-options] Missing Supabase env", {
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

export type QuoteOptionListRow = {
  id: string;
  quote_id: string;
  label: string | null;
  carrier: string | null;
  service_name: string | null;
  total_price: number | null;
  currency: string | null;
  internal_cost: number | null;
  internal_profit: number | null;
  status: string | null;
  sent_at: string | null;
  created_at: string | null;
};

export async function GET(req: NextRequest) {
  const staff = await requireStaff();
  if ("response" in staff) return staff.response;

  const supabase = makeSupabase();
  if (!supabase) {
    return jsonError(500, "NO_SUPABASE_CONFIG");
  }

  const { searchParams } = new URL(req.url);
  const scope = searchParams.get("scope") || "sent";

  try {
    const query = supabase
      .from("quote_options")
      .select(
        [
          "id",
          "quote_id",
          "label",
          "carrier",
          "service_name",
          "total_price",
          "currency",
          "internal_cost",
          "internal_profit",
          "status",
          "sent_at",
          "created_at",
        ].join(", ")
      )
      .order("sent_at", { ascending: false });

    if (scope === "sent") {
      // @ts-ignore
      query.not("sent_at", "is", null);
    }

    const { data, error } = await query;

    if (error) {
      console.error("[API/quote-options:GET] DB error", error);
      return jsonError(500, "DB_ERROR", { message: error.message });
    }

    return NextResponse.json(
      {
        ok: true,
        rows: (data || []) as unknown as QuoteOptionListRow[],
      },
      { status: 200 }
    );
  } catch (e: any) {
    console.error("[API/quote-options:GET] ERROR", e?.message || e);
    return jsonError(500, "SERVER_ERROR", { message: e?.message });
  }
}
