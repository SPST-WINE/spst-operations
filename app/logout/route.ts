// app/logout/route.ts
import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const supabase = supabaseServer();

  try {
    await supabase.auth.signOut();
  } catch {
    // anche se fallisce, proseguiamo con redirect
  }

  const url = new URL("/login", req.url);
  return NextResponse.redirect(url);
}
