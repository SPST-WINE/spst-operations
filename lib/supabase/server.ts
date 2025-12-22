// lib/supabase/server.ts
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

function getEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const anon =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

  if (!url || !anon) {
    console.error("[supabaseServer] Missing env", { hasUrl: !!url, hasAnon: !!anon });
  }
  return { url: url!, anon: anon! };
}

// Default: schema public (così non rompiamo tabelle public tipo public.backoffice_links)
export function supabaseServer(): ReturnType<typeof createServerClient> {
  const { url, anon } = getEnv();
  const cookieStore = cookies();

  return createServerClient(url, anon, {
    cookies: {
      get(name: string) {
        return cookieStore.get(name)?.value;
      },
      set(name: string, value: string, options: any) {
        cookieStore.set({ name, value, ...options });
      },
      remove(name: string, options: any) {
        cookieStore.set({ name, value: "", ...options });
      },
    },
  });
}

// SPST schema: per tabelle in schema "spst" (customers, addresses, staff_users, ecc.)
export function supabaseServerSpst() {
  const { url, anon } = getEnv();
  const cookieStore = cookies();

  return createServerClient(url, anon, {
    db: { schema: "spst" },
    cookies: {
      get(name: string) {
        return cookieStore.get(name)?.value;
      },
      set(name: string, value: string, options: any) {
        cookieStore.set({ name, value, ...options });
      },
      remove(name: string, options: any) {
        cookieStore.set({ name, value: "", ...options });
      },
    },
  }) as any; // (any) per evitare rogne di typing quando il progetto non ha Database types generati
}
