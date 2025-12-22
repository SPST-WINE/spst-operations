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
    const { data, error: custErr } = await supabase
      .from("spst.customers")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle();

    const customerId = data?.id || null;

    if (custErr || !customerId) {
      return NextResponse.json(
        { ok: true, has_shipper: false, reason: "no_customer" },
        { status: 200 }
      );
    }

    // 2) shipper address exists?
    const { count } = await supabase
      .from("spst.addresses")
      .select("id", { head: true, count: "exact" })
      .eq("customer_id", customerId)
      .eq("type", "shipper");

    const hasShipper = (count || 0) > 0;

    return NextResponse.json({ ok: true, has_shipper: hasShipper }, { status: 200 });
  } catch (e: any) {
    // fail-open
    return NextResponse.json(
      { ok: false, error: e?.message || "onboarding-status error" },
      { status: 200 }
    );
  }
}
