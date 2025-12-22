// lib/auth/requireStaff.ts
import { NextResponse } from "next/server";
import { supabaseServerSpst } from "@/lib/supabase/server";

export type StaffAuthResult =
  | { ok: true; userId: string; email: string }
  | { ok: false; response: NextResponse };

export async function requireStaff(): Promise<StaffAuthResult> {
  const supabase = supabaseServerSpst();

  const {
    data: { user },
    error: userErr,
  } = await supabase.auth.getUser();

  if (userErr || !user?.id || !user?.email) {
    return {
      ok: false,
      response: NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 }),
    };
  }

  // staff_users: (user_id uuid, email text, role text, enabled bool, ...)
  const { data: staff, error: staffErr } = await supabase
    .from("staff_users")
    .select("user_id, email, enabled, role")
    .eq("user_id", user.id)
    .maybeSingle();

  // Se tabella/policy non ok → NON far passare (backoffice deve essere blindato)
  if (staffErr || !staff) {
    return {
      ok: false,
      response: NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 }),
    };
  }

  if (typeof (staff as any).enabled === "boolean" && (staff as any).enabled !== true) {
    return {
      ok: false,
      response: NextResponse.json({ ok: false, error: "STAFF_DISABLED" }, { status: 403 }),
    };
  }

  return { ok: true, userId: user.id, email: user.email };
}
