// middleware.ts
import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

function getEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const anon =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

  return { url, anon };
}

export async function middleware(req: NextRequest) {
  const { url, anon } = getEnv();

  // Se manca env, non blocco (ma loggo) per evitare downtime.
  if (!url || !anon) {
    console.error("[middleware] Missing Supabase env", {
      hasUrl: !!url,
      hasAnon: !!anon,
    });
    return NextResponse.next();
  }

  // response che useremo per scrivere eventuali cookie aggiornati
  const res = NextResponse.next();

  const supabase = createServerClient(url, anon, {
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

  // Verifica sessione
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Se non autenticato → redirect login con next
  if (!user) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("next", req.nextUrl.pathname + req.nextUrl.search);
    return NextResponse.redirect(loginUrl);
  }

  return res;
}

export const config = {
  matcher: ["/dashboard/:path*"],
};
