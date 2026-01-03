import { NextResponse } from "next/server";
import { requireStaff } from "@/lib/auth/requireStaff";
import { supabaseServerSpst } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * Staff-only.
 * Returns the available private carriers configured in spst.carriers.
 * (MVP: used to pick SDF when creating a WAVE.)
 */
export async function GET() {
  const staff = await requireStaff();
  if (!staff) {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  const supabase = supabaseServerSpst();

  const { data, error } = await supabase
    .from("carriers")
    .select("id,name")
    .order("name", { ascending: true });

  if (error) {
    console.error("[GET /api/pallets/carriers] DB error:", error);
    return NextResponse.json({ error: "DB_ERROR" }, { status: 500 });
  }

  return NextResponse.json({ items: data ?? [] });
}
