// lib/supabase/browser.ts
import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

type AnySupa = SupabaseClient<any, any, any, any, any>;

let _client: AnySupa | null = null;

export function supabaseBrowser(): AnySupa {
  if (_client) return _client;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anon) {
    console.error("[supabaseBrowser] Missing env", {
      hasUrl: !!url,
      hasAnon: !!anon,
    });
  }

  _client = createBrowserClient(url!, anon!, {
    db: { schema: "spst" },
  }) as unknown as AnySupa;

  return _client;
}
