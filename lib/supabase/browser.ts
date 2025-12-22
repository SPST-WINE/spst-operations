// lib/supabase/browser.ts
import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

export function supabaseBrowser(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anon) {
    // Non throw per non rompere build in edge-cases,
    // ma è meglio che in dev tu lo veda subito.
    console.error("[supabaseBrowser] Missing env", {
      hasUrl: !!url,
      hasAnon: !!anon,
    });
  }

  return createBrowserClient(url!, anon!);
}
