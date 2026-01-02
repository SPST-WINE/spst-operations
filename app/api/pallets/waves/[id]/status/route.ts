import { NextResponse } from "next/server";
import { requireStaff } from "@/lib/auth/requireStaff";
import { supabaseServerSpst } from "@/lib/supabase/server";

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  const staff = await requireStaff();
  if (!staff) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });

  const { status } = await req.json();

  const supabase = supabaseServerSpst();

  const { error } = await supabase
    .from("pallet_waves")
    .update({ status })
    .eq("id", params.id);

  if (error) {
    console.error("[PATCH /api/pallets/waves/:id/status]", error);
    return NextResponse.json({ error: "DB_ERROR" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
