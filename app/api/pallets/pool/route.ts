import { NextResponse } from "next/server";
import { supabaseServerSpst } from "@/lib/supabase/server";
import { requireStaff } from "@/lib/auth/requireStaff";

export const dynamic = "force-dynamic";

export async function GET() {
  // 🔐 AUTH
  const staff = await requireStaff();
  if (!staff) {
    return NextResponse.json(
      { error: "FORBIDDEN" },
      { status: 403 }
    );
  }

  const supabase = supabaseServerSpst();

  // 🧠 QUERY CANONICA
  const { data, error } = await supabase.rpc("get_pallets_pool");

  if (error) {
    console.error("[GET /api/pallets/pool] DB error:", error);
    return NextResponse.json(
      { error: "DB_ERROR" },
      { status: 500 }
    );
  }

  return NextResponse.json({
    items: data ?? [],
  });
}
