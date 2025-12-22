// app/api/quote-options/[id]/route.ts
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
    console.error("[API/quote-options/:id DELETE] Missing Supabase env", {
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

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const staff = await requireStaff();
  if ("response" in staff) return staff.response;

  const id = params.id;

  if (!id) {
    return NextResponse.json(
      { ok: false, error: "ID opzione mancante" },
      { status: 400 }
    );
  }

  const supabase = makeSupabase();
  if (!supabase) {
    return NextResponse.json(
      { ok: false, error: "Supabase non configurato" },
      { status: 500 }
    );
  }

  try {
    const { error } = await supabase
      .from("quote_options")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("[API/quote-options/:id DELETE] DB error:", error);
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (e: any) {
    console.error("[API/quote-options/:id DELETE] ERROR:", e);
    return NextResponse.json(
      { ok: false, error: e?.message || "Errore server" },
      { status: 500 }
    );
  }
}
