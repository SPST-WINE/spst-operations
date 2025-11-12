import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { Pool } from "pg";

/* ----------------------------- shared utils ------------------------------ */

const mask = (v?: string | null, keep: number = 4) =>
  !v ? "(empty)" : v.length <= keep ? "*".repeat(v.length) : v.slice(0, keep) + "…" + "*".repeat(Math.max(0, v.length - keep - 1));
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function logEnvSummary() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const keySR = process.env.SUPABASE_SERVICE_ROLE || process.env.SUPABASE_SERVICE_ROLE_KEY;
  const dbUrl = process.env.DATABASE_URL;
  console.warn("[API/my-shipments] ENV summary:", {
    NEXT_PUBLIC_SUPABASE_URL: url ? url.replace(/^https?:\/\//, "").split(".supabase.co")[0] + ".supabase.co" : "(missing)",
    SUPABASE_SERVICE_ROLE: keySR ? mask(keySR) : "(missing)",
    DATABASE_URL: dbUrl ? (dbUrl.startsWith("postgres://") || dbUrl.startsWith("postgresql://") ? "postgres(…)" : "(present)") : "(missing)",
  });
}

/* ----------------------------- supabase admin ---------------------------- */
/** Nessun return type: evitiamo il mismatch `"public"` vs `"spst"` e castiamo a `any`. */
function supabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE ||
    process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    logEnvSummary();
    throw new Error("SUPABASE_ADMIN_MISCONFIG: missing url or service key");
  }

  return createClient(url, key, {
    db: { schema: "spst" },
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { "X-Client-Info": "spst-operations/my-shipments" } },
  }) as any;
}

function logPgRestError(tag: string, err: any) {
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

/* ----------------------------- direct PG client -------------------------- */

function makePgPool(): Pool | null {
  const cs = process.env.DATABASE_URL;
  if (!cs) return null;

  const hasParams = cs.includes("?");
  const needsSslMode = !/sslmode=/i.test(cs);
  const finalCs = hasParams
    ? (needsSslMode ? cs + "&sslmode=require" : cs)
    : (needsSslMode ? cs + "?sslmode=require" : cs);

  return new Pool({
    connectionString: finalCs,
    ssl: { rejectUnauthorized: false },
    max: 2,
  });
}

const SELECT_COLS = `
  id,
  human_id,
  tipo_spedizione,
  incoterm,
  mittente_citta,
  dest_citta,
  giorno_ritiro,
  colli_n,
  peso_reale_kg,
  created_at
`;

/* --------------------------------- GET ----------------------------------- */

export async function GET(req: Request) {
  const u = new URL(req.url);
  const debug = u.searchParams.get("debug") === "1";

  logEnvSummary();

  // 1) Tentativi via REST
  let tries = 0;
  let firstError: any = null;
  let lastError: any = null;

  let sb: any;
  try {
    sb = supabaseAdmin();
  } catch (e: any) {
    logPgRestError("bootstrap", e);
    sb = undefined as any;
  }

  if (sb) {
    while (tries < 3) {
      tries++;
      try {
        const warm = await sb.from("shipments").select("id", { head: true, count: "exact" });
        if (warm?.error) logPgRestError("warmup", warm.error);

        const { data, error } = await sb
          .from("shipments")
          .select(SELECT_COLS.replace(/\s+/g, " ").trim())
          .order("created_at", { ascending: false })
          .limit(100);

        if (error) {
          if (!firstError) firstError = error;
          lastError = error;
          logPgRestError(`select (try ${tries})`, error);
          if (String(error?.code) === "PGRST002" || /schema cache/i.test(String(error?.message))) {
            await sleep(500 * tries);
            continue;
          }
          break;
        }

        return NextResponse.json(
          { ok: true, rows: Array.isArray(data) ? data : [], source: "rest", debug: debug ? { tries } : undefined },
          { status: 200 }
        );
      } catch (e: any) {
        if (!firstError) firstError = e;
        lastError = e;
        logPgRestError(`unexpected (try ${tries})`, e);
        await sleep(500 * tries);
      }
    }
  }

  // 2) Fallback PG
  const pool = makePgPool();
  if (!pool) {
    return NextResponse.json(
      {
        ok: false,
        rows: [],
        error: firstError?.message ?? "DB_SELECT_FAILED",
        details: firstError?.details ?? firstError?.hint ?? firstError?.code ?? "no DATABASE_URL; rest failed",
        debug: debug ? { tries, firstError, lastError, source: "rest->none" } : undefined,
      },
      { status: 500 }
    );
  }

  let client;
  try {
    client = await pool.connect();
    const q = `
      select ${SELECT_COLS}
      from spst.shipments
      order by created_at desc
      limit 100
    `;
    const r = await client.query(q);
    return NextResponse.json(
      { ok: true, rows: r.rows ?? [], source: "pg", debug: debug ? { tries, fallback: true } : undefined },
      { status: 200 }
    );
  } catch (e: any) {
    logPgRestError("pg-fallback", e);
    return NextResponse.json(
      {
        ok: false,
        rows: [],
        error: e?.message ?? "PG_FALLBACK_FAILED",
        details: e?.code ?? e?.name,
        debug: debug ? { tries, firstError, lastError, source: "pg" } : undefined,
      },
      { status: 500 }
    );
  } finally {
    try { client?.release?.(); } catch {}
    try { await pool.end(); } catch {}
  }
}
