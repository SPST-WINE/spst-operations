// lib/supabase/browser.ts
import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

let _client: SupabaseClient | null = null;

export function supabaseBrowser(): SupabaseClient {
  if (_client) return _client;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  if (!url || !anon) {
    console.error("[supabaseBrowser] Missing env", { hasUrl: !!url, hasAnon: !!anon });
  }

  // ✅ browser client che usa cookie (compatibile col middleware)
  _client = createBrowserClient(url, anon, {
    db: { schema: "spst" },
  });

  return _client;
}
