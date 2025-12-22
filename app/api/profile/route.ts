// app/api/profile/route.ts
import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const supabase = supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.email) {
    return NextResponse.json(
      { ok: false, error: "UNAUTHORIZED", profile: null },
      { status: 401 }
    );
  }

  return NextResponse.json(
    {
      ok: true,
      profile: {
        email: user.email,
        id: user.id,
      },
    },
    { status: 200 }
  );
}
