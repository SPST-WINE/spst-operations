// app/api/auth/login/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

function makeSupabase(req: NextRequest, res: NextResponse) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  return createServerClient(url, anon, {
    cookies: {
      get(name: string) {
        return req.cookies.get(name)?.value;
      },
      set(name: string, value: string, options: any) {
        res.cookies.set({ name, value, ...options });
      },
      remove(name: string, options: any) {
        res.cookies.set({ name, value: "", ...options, maxAge: 0 });
      },
    },
  });
}

export async function POST(req: NextRequest) {
  const res = NextResponse.json({ ok: false }, { status: 200 });

  let body: any = null;
  try {
    body = await req.json();
  } catch {}

  const email = String(body?.email || "").trim();
  const password = String(body?.password || "");

  if (!email || !password) {
    return NextResponse.json(
      { ok: false, error: "MISSING_CREDENTIALS" },
      { status: 400 }
    );
  }

  const supabase = makeSupabase(req, res);

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error || !data.session) {
    return NextResponse.json(
      { ok: false, error: "INVALID_LOGIN", message: error?.message || "" },
      { status: 401 }
    );
  }

  // ✅ IMPORTANT: ritorno la risposta che contiene i cookie settati dal server client
  return NextResponse.json({ ok: true }, { status: 200, headers: res.headers });
}
