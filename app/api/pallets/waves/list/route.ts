import { NextResponse } from "next/server";
import { supabaseServerSpst } from "@/lib/supabase/server";

export async function GET() {
  const supabase = supabaseServerSpst();

  const { data, error } = await supabase
    .from("pallet_waves")
    .select(`
      id,
      code,
      status,
      planned_pickup_date,
      pickup_window,
      notes,
      created_at,
      carriers(name)
    `)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[GET /api/pallets/waves]", error);
    return NextResponse.json({ error: "DB_ERROR" }, { status: 500 });
  }

  return NextResponse.json({ items: data ?? [] });
}
