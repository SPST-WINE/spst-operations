// app/api/onboarding-status/route.ts
import { NextResponse } from "next/server";
import { supabaseServerSpst } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const supabase = supabaseServerSpst();

  const {
    data: { user },
    error: userErr,
  } = await supabase.auth.getUser();

  if (userErr || !user?.id) {
    return NextResponse.json(
      { ok: false, error: "UNAUTHORIZED", has_shipper: false },
      { status: 401 }
    );
  }

  // customer del user
  const { data: customer, error: custErr } = await supabase
    .from("customers")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (custErr) {
    return NextResponse.json(
      { ok: false, error: "DB_ERROR", message: custErr.message, has_shipper: false },
      { status: 500 }
    );
  }

  if (!customer?.id) {
    return NextResponse.json({ ok: true, has_shipper: false });
  }

  // shipper address (colonna: kind)
  const { data: shipper, error: shipErr } = await supabase
    .from("addresses")
    .select("id")
    .eq("customer_id", customer.id)
    .eq("kind", "shipper")
    .limit(1)
    .maybeSingle();

  if (shipErr) {
    return NextResponse.json(
      { ok: false, error: "DB_ERROR", message: shipErr.message, has_shipper: false },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, has_shipper: !!shipper?.id });
}
