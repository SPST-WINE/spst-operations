import { NextResponse } from "next/server";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

/* ----------------------------- utils logging ----------------------------- */

const mask = (v?: string | null, keep: number = 4) =>
  !v ? "(empty)" : v.length <= keep ? "*".repeat(v.length) : v.slice(0, keep) + "…" + "*".repeat(Math.max(0, v.length - keep - 1));

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function logEnvSummary() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const keySR = process.env.SUPABASE_SERVICE_ROLE || process.env.SUPABASE_SERVICE_ROLE_KEY;
  console.warn("[API/my-shipments] ENV summary:", {
    NEXT_PUBLIC_SUPABASE_URL: url ? url.replace(/^https?:\/\//, "").split(".supabase.co")[0] + ".supabase.co" : "(missing)",
    SUPABASE_SERVICE_ROLE: keySR ? mask(keySR) : "(missing)",
  });
}

function supabaseAdmin(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE ||
    process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    logEnvSummary();
    throw new Error("SUPABASE_ADMIN_MISCONFIG: missing url or service key");
  }
  return createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    global: {
      headers: {
        "X-Client-Info": "spst-operations/my-shipments",
      },
    },
  });
}

function logPgRestError(tag: string, err: any) {
  // tipica shape postgrest: { code, details, hint, message }
  try {
    console.error(`[API/my-shipments] ${tag} error:`, {
      code: err?.code,
      details: err?.details,
      hint: err?.hint,
      message: err?.message ?? String(err),
    });
  } catch {
    console.error(`[API/my-shipments] ${tag} raw error:`, err);
  }
}

/* ----------------------------- handler GET ------------------------------ */

export async function GET(req: Request) {
  const url = new URL(req.url);
  const wantDebug = url.searchParams.get("debug") === "1";

  let tries = 0;
  let firstError: any = null;
  let lastError: any = null;

  logEnvSummary();

  let client: SupabaseClient;
  try {
    client = supabaseAdmin();
  } catch (e: any) {
    logPgRestError("bootstrap", e);
    return NextResponse.json(
      { ok: false, rows: [], error: e?.message ?? "BOOTSTRAP_ERROR" },
      { status: 500 }
    );
  }

  // Query di base
  const selectCols =
    "id,human_id,tipo_spedizione,incoterm,mittente_citta,dest_citta,giorno_ritiro,colli_n,peso_reale_kg,created_at";

  // Retry: PGRST002 capita subito dopo migrazioni/policy update (schema cache).
  while (tries < 3) {
    tries++;
    try {
      // piccola “warm-up” con HEAD per stimolare schema cache
      const warmup = await client
        .from("shipments")
        .select("id", { head: true, count: "exact" });

      if (warmup.error) {
        logPgRestError("warmup", warmup.error);
      } else {
        console.warn("[API/my-shipments] warmup ok; count:", warmup.count);
      }

      const { data, error } = await client
        .from("shipments")
        .select(selectCols)
        .order("created_at", { ascending: false })
        .limit(100);

      if (error) {
        if (!firstError) firstError = error;
        lastError = error;
        logPgRestError(`select (try ${tries})`, error);

        // Se è il famoso PGRST002 -> backoff e retry
        if (String(error?.code) === "PGRST002" || /schema cache/i.test(String(error?.message))) {
          await sleep(500 * tries); // 500ms, 1s, 1.5s
          continue;
        }

        // Altri errori: niente retry
        return NextResponse.json(
          {
            ok: false,
            rows: [],
            error: error.message ?? "DB_SELECT_FAILED",
            details: error.details ?? error.hint ?? error.code,
            debug: wantDebug
              ? {
                  tries,
                  firstError,
                  lastError,
                }
              : undefined,
          },
          { status: 500 }
        );
      }

      // Successo
      return NextResponse.json(
        {
          ok: true,
          rows: Array.isArray(data) ? data : [],
          debug: wantDebug ? { tries } : undefined,
        },
        { status: 200 }
      );
    } catch (e: any) {
      if (!firstError) firstError = e;
      lastError = e;
      logPgRestError(`unexpected (try ${tries})`, e);
      await sleep(500 * tries);
    }
  }

  // Se siamo qui, i retry non sono bastati
  return NextResponse.json(
    {
      ok: false,
      rows: [],
      error: firstError?.message ?? "DB_SELECT_FAILED",
      details:
        firstError?.details ??
        firstError?.hint ??
        firstError?.code ??
        "schema cache / connectivity?",
      debug: wantDebug ? { tries, firstError, lastError } : undefined,
    },
    { status: 500 }
  );
}
