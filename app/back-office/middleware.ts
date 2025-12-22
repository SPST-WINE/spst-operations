// middleware.ts
import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

export const config = {
  matcher: ["/back-office/:path*"],
};

function supa(req: NextRequest, res: NextResponse) {
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
        res.cookies.set({ name, value: "", ...options });
      },
    },
  });
}

export async function middleware(req: NextRequest) {
  const res = NextResponse.next();
  const supabase = supa(req, res);

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const nextPath = req.nextUrl.pathname + (req.nextUrl.search || "");

  // 1) Non loggato → login
  if (!user) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", nextPath);
    return NextResponse.redirect(url);
  }

  // 2) Loggato ma NON staff → redirect (o 403 page)
  const { data: staffRow } = await supabase
    .schema("spst")
    .from("staff_users")
    .select("user_id, role")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!staffRow?.user_id) {
    const url = req.nextUrl.clone();
    url.pathname = "/dashboard"; // o una pagina "not authorized"
    url.searchParams.set("error", "not_staff");
    return NextResponse.redirect(url);
  }

  return res;
}
