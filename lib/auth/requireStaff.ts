// lib/auth/requireStaff.ts
import { NextResponse } from "next/server";
import { supabaseServerSpst } from "@/lib/supabase/server";

export type StaffRole = "admin" | "staff" | "operator";

// Break-glass: SOLO qui (meglio tenerlo minimale)
const ADMIN_EMAIL_ALLOWLIST = new Set<string>(["info@spst.it"]);

export async function requireStaff(): Promise<{
  userId: string;
  email: string;
  role: StaffRole;
}> {
  const supabase = supabaseServerSpst();

  const {
    data: { user },
    error: userErr,
  } = await supabase.auth.getUser();

  if (userErr || !user?.id || !user?.email) {
    throw NextResponse.json(
      { ok: false, error: "UNAUTHENTICATED" },
      { status: 401 }
    );
  }

  const email = user.email.toLowerCase().trim();

  // ✅ admin “break-glass”
  if (ADMIN_EMAIL_ALLOWLIST.has(email)) {
    return { userId: user.id, email, role: "admin" };
  }

  const { data: staff, error } = await supabase
    .from("staff_users")
    .select("user_id, role, enabled, email")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error || !staff) {
    throw NextResponse.json(
      { ok: false, error: "STAFF_REQUIRED" },
      { status: 403 }
    );
  }

  const enabled =
    typeof (staff as any).enabled === "boolean" ? (staff as any).enabled : true;

  if (!enabled) {
    throw NextResponse.json(
      { ok: false, error: "STAFF_DISABLED" },
      { status: 403 }
    );
  }

  const roleRaw = String((staff as any).role || "").toLowerCase().trim();
  const role =
    roleRaw === "admin" || roleRaw === "staff" || roleRaw === "operator"
      ? (roleRaw as StaffRole)
      : null;

  if (!role) {
    throw NextResponse.json(
      { ok: false, error: "STAFF_REQUIRED" },
      { status: 403 }
    );
  }

  return { userId: user.id, email, role };
}
