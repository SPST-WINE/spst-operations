// middleware.ts
import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

function getEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const anon =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

  if (!url || !anon) {
    console.error("[middleware] Missing env", { hasUrl: !!url, hasAnon: !!anon });
  }
  return { url: url!, anon: anon! };
}

function isBackofficePath(pathname: string) {
  return (
    pathname.startsWith("/back-office") ||
    pathname.startsWith("/api/backoffice")
  );
}

function isCarrierPath(pathname: string) {
  return pathname.startsWith("/carrier");
}

export async function middleware(req: NextRequest) {
  const { url, anon } = getEnv();

  // se manca env, non blocco per evitare downtime, ma loggo
  if (!url || !anon) return NextResponse.next();

  let res = NextResponse.next();

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

  // keep session fresh - getSession() automatically refreshes the session if needed
  await supabase.auth.getSession();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = req.nextUrl.pathname;

  // Qualsiasi area protetta: se non loggato -> login
  if (!user) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("next", req.nextUrl.pathname + req.nextUrl.search);
    return NextResponse.redirect(loginUrl);
  }

  const email = (user.email || "").toLowerCase().trim();

  // ✅ hard allowlist "break-glass" per admin principale
  if (email === "info@spst.it") {
    return res;
  }

  // ---------------------------
  // Carrier portal: serve carrier enabled
  // ---------------------------
  if (isCarrierPath(pathname)) {
    const { data: cu, error } = await supabase
      .schema("spst")
      .from("carrier_users")
      .select("user_id, carrier_id, role, enabled")
      .eq("user_id", user.id)
      .maybeSingle();

    if (error || !cu) {
      // pagine carrier -> redirect dashboard
      // (se in futuro aggiungi API carrier-only sotto /carrier/api, qui puoi distinguere)
      return NextResponse.redirect(new URL("/dashboard", req.url));
    }

    const enabled =
      typeof (cu as any).enabled === "boolean" ? (cu as any).enabled : true;
    const role = String((cu as any).role || "").toLowerCase().trim();

    const isCarrier = role === "carrier" || role === "driver" || role === "admin";

    if (!enabled || !isCarrier) {
      return NextResponse.redirect(new URL("/dashboard", req.url));
    }

    return res;
  }

  // ---------------------------
  // Back-office: serve staff/admin
  // ---------------------------
  if (isBackofficePath(pathname)) {
    // Verifica su tabella spst.staff_users (schema spst)
    const { data: staff, error } = await supabase
      .schema("spst")
      .from("staff_users")
      .select("user_id, role, enabled, email")
      .eq("user_id", user.id)
      .maybeSingle();

    if (error || !staff) {
      // per API -> 403 JSON, per pagine -> redirect dashboard
      if (pathname.startsWith("/api/")) {
        return NextResponse.json(
          { ok: false, error: "STAFF_REQUIRED" },
          { status: 403 }
        );
      }
      return NextResponse.redirect(new URL("/dashboard", req.url));
    }

    const enabled =
      typeof (staff as any).enabled === "boolean" ? (staff as any).enabled : true;

    const role = String((staff as any).role || "").toLowerCase().trim();
    const isStaff = role === "admin" || role === "staff" || role === "operator";

    if (!enabled || !isStaff) {
      if (pathname.startsWith("/api/")) {
        return NextResponse.json(
          { ok: false, error: "STAFF_DISABLED" },
          { status: 403 }
        );
      }
      return NextResponse.redirect(new URL("/dashboard", req.url));
    }
  }

  return res;
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/back-office/:path*",
    "/api/backoffice/:path*",
    "/carrier/:path*",
  ],
};
