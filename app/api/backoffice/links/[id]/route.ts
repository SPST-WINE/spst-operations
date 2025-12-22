// app/api/backoffice/links/[id]/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireStaff } from "@/lib/auth/requireStaff";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type Params = { params: { id: string } };

function envOrThrow(name: string): string {
  const v = process.env[name];
  if (!v || !v.trim()) {
    throw new Error(`Missing env ${name}`);
  }
  return v;
}

function admin() {
  const url = envOrThrow("NEXT_PUBLIC_SUPABASE_URL");
  const key =
    process.env.SUPABASE_SERVICE_ROLE ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    envOrThrow("SUPABASE_SERVICE_ROLE");

  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export async function PATCH(req: Request, { params }: Params) {
  const staff = await requireStaff();
  if ("response" in staff) return staff.response;

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

    const supa = admin();

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
  const staff = await requireStaff();
  if ("response" in staff) return staff.response;

  const { id } = params;

  try {
    if (!id) {
      return NextResponse.json(
        { ok: false, error: "MISSING_ID" },
        { status: 400 }
      );
    }

    const supa = admin();

    // soft delete: is_active = false
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
