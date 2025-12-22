// lib/auth/requireStaff.ts
import { NextRequest } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

export async function requireStaff(_req: NextRequest) {
  const supabase = supabaseServer();

  const {
    data: { user },
    error: userErr,
  } = await supabase.auth.getUser();

  if (userErr || !user) return { ok: false as const, user: null };

  const { data: staff } = await supabase
    .schema("spst")
    .from("staff_users")
    .select("user_id, role")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!staff?.user_id) return { ok: false as const, user: null };

  return { ok: true as const, user, role: staff.role };
}
