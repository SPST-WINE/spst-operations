// app/api/quote-options/[id]/route.ts
import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";

export async function DELETE(
  req: Request,
  { params }: { params: { id: string } }
) {
  const id = params.id;

  if (!id) {
    return NextResponse.json(
      { ok: false, error: "ID opzione mancante" },
      { status: 400 }
    );
  }

  try {
    const supabase = await createSupabaseServer();

    const { error } = await supabase
      .schema("spst")
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
