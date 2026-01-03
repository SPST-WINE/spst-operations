import { NextResponse } from "next/server";
import { requireStaff } from "@/lib/auth/requireStaff";
import { supabaseServerSpst } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

function isResponse(x: any): x is Response {
  return x instanceof Response;
}

/**
 * Staff-only.
 * Returns the available private carriers configured in spst.carriers.
 * (MVP: used to pick SDF when creating a WAVE.)
 */
export async function GET() {
  const staffRes: any = await requireStaff();

  // Caso A: requireStaff() ritorna direttamente una Response/NextResponse
  if (isResponse(staffRes)) {
    return staffRes;
  }

  // Caso B: ritorna un oggetto ok=false (con o senza response)
  if (!staffRes || staffRes.ok !== true) {
    if (staffRes?.response && isResponse(staffRes.response)) {
      return staffRes.response;
    }
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  // Caso C: ok=true → puoi procedere
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
