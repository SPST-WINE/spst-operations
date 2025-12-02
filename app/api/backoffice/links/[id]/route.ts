// app/api/backoffice/links/[id]/route.ts
import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";

type Params = { params: { id: string } };

export async function PATCH(req: Request, { params }: Params) {
  const { id } = params;

  try {
    const body = await req.json().catch(() => ({}));
    const { label, url, description, sort_order, is_active } = body || {};

    if (!id) {
      return NextResponse.json(
        { ok: false, error: "MISSING_ID" },
        { status: 400 }
      );
    }

    const supa = createSupabaseServer();

    const payload: any = {};
    if (label !== undefined) payload.label = label;
    if (url !== undefined) payload.url = url;
    if (description !== undefined) payload.description = description;
    if (sort_order !== undefined) payload.sort_order = sort_order;
    if (is_active !== undefined) payload.is_active = is_active;

    const { data, error } = await supa
      .from("backoffice_links")
      .update(payload)
      .eq("id", id)
      .select("*")
      .single();

    if (error) {
      console.error("[backoffice_links][PATCH] error:", error);
      return NextResponse.json(
        { ok: false, error: "DB_ERROR", details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true, row: data });
  } catch (e: any) {
    console.error("[backoffice_links][PATCH] unexpected:", e);
    return NextResponse.json(
      { ok: false, error: "UNEXPECTED_ERROR", details: String(e?.message || e) },
      { status: 500 }
    );
  }
}

export async function DELETE(_req: Request, { params }: Params) {
  const { id } = params;

  try {
    if (!id) {
      return NextResponse.json(
        { ok: false, error: "MISSING_ID" },
        { status: 400 }
      );
    }

    const supa = createSupabaseServer();

    // soft delete: set is_active = false
    const { data, error } = await supa
      .from("backoffice_links")
      .update({ is_active: false })
      .eq("id", id)
      .select("*")
      .single();

    if (error) {
      console.error("[backoffice_links][DELETE] error:", error);
      return NextResponse.json(
        { ok: false, error: "DB_ERROR", details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true, row: data });
  } catch (e: any) {
    console.error("[backoffice_links][DELETE] unexpected:", e);
    return NextResponse.json(
      { ok: false, error: "UNEXPECTED_ERROR", details: String(e?.message || e) },
      { status: 500 }
    );
  }
}
