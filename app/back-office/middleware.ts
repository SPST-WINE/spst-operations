// middleware.ts
import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

function makeEdgeSupabase(req: NextRequest, res: NextResponse, schema?: "spst") {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const anon =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

  return createServerClient(url!, anon!, {
    ...(schema ? { db: { schema } } : {}),
    cookies: {
      get(name: string) {
        return req.cookies.get(name)?.value;
      },
      set(name: string, value: string, options: any) {
        res.cookies.set({ name, value, ...options });
      },
      remove(name: string, options: any) {
        res.cookies.set({ name, value: "", ...options });
      },
    },
  });
}

export async function middleware(req: NextRequest) {
  const path = req.nextUrl.pathname;

  // --- Protect dashboard: logged users ---
  if (path.startsWith("/dashboard")) {
    const res = NextResponse.next();
    const supabase = makeEdgeSupabase(req, res);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      const login = new URL("/login", req.url);
      login.searchParams.set("next", path);
      return NextResponse.redirect(login);
    }
    return res;
  }

  // --- Protect back-office: staff only ---
  if (path.startsWith("/back-office") || path.startsWith("/api/backoffice")) {
    const res = NextResponse.next();

    // user auth
    const supabaseAuth = makeEdgeSupabase(req, res);
    const {
      data: { user },
    } = await supabaseAuth.auth.getUser();

    if (!user) {
      const login = new URL("/login", req.url);
      login.searchParams.set("next", path);
      return NextResponse.redirect(login);
    }

    // staff check (schema spst)
    const supabaseSpst = makeEdgeSupabase(req, res, "spst");
    const { data: staff, error } = await supabaseSpst
      .from("staff_users")
      .select("user_id, enabled")
      .eq("user_id", user.id)
      .maybeSingle();

    if (error || !staff || (typeof (staff as any).enabled === "boolean" && (staff as any).enabled !== true)) {
      return NextResponse.redirect(new URL("/dashboard", req.url));
    }

    return res;
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/back-office/:path*", "/api/backoffice/:path*"],
};
