// app/api/onboarding-status/route.ts
import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    const supabase = supabaseServer();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { ok: true, has_shipper: false, reason: "no_user" },
        { status: 200 }
      );
    }

    // 1) customer_id
    const { data: customer, error: custErr } = await supabase
      .schema("spst")
      .from("customers")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle();

    // se manca customer (trigger mancante o caso raro) → redirect a impostazioni
    if (custErr || !customer?.id) {
      return NextResponse.json(
        { ok: true, has_shipper: false, reason: "no_customer" },
        { status: 200 }
      );
    }

    // 2) shipper address exists?
    // ✅ Se hai una tabella diversa (es. shipper_defaults), me la dici e la adeguo.
    const { count } = await supabase
      .schema("spst")
      .from("addresses")
      .select("id", { head: true, count: "exact" })
      .eq("customer_id", customer.id)
      .eq("type", "shipper");

    const hasShipper = (count || 0) > 0;

    return NextResponse.json(
      { ok: true, has_shipper: hasShipper },
      { status: 200 }
    );
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message || "onboarding-status error" },
      { status: 200 } // fail-open lato client
    );
  }
}
