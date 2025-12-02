// app/api/backoffice/links/route.ts
import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";

export async function GET() {
  try {
    const supa = createSupabaseServer();

    const { data, error } = await supa
      .from("backoffice_links")
      .select("*")
      .eq("is_active", true)
      .order("category", { ascending: true })
      .order("sort_order", { ascending: true })
      .order("label", { ascending: true });

    if (error) {
      console.error("[backoffice_links][GET] error:", error);
      return NextResponse.json(
        { ok: false, error: "DB_ERROR", details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true, rows: data ?? [] });
  } catch (e: any) {
    console.error("[backoffice_links][GET] unexpected:", e);
    return NextResponse.json(
      { ok: false, error: "UNEXPECTED_ERROR", details: String(e?.message || e) },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const { category, label, url, description, sort_order } = body || {};

    if (!category || !label || !url) {
      return NextResponse.json(
        { ok: false, error: "MISSING_FIELDS" },
        { status: 400 }
      );
    }

    const supa = createSupabaseServer();

    const { data, error } = await supa
      .from("backoffice_links")
      .insert([
        {
          category,
          label,
          url,
          description: description || null,
          sort_order: typeof sort_order === "number" ? sort_order : 100,
        },
      ])
      .select("*")
      .single();

    if (error) {
      console.error("[backoffice_links][POST] error:", error);
      return NextResponse.json(
        { ok: false, error: "DB_ERROR", details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true, row: data });
  } catch (e: any) {
    console.error("[backoffice_links][POST] unexpected:", e);
    return NextResponse.json(
      { ok: false, error: "UNEXPECTED_ERROR", details: String(e?.message || e) },
      { status: 500 }
    );
  }
}
