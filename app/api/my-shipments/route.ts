import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { Pool } from "pg";

/* ----------------------------- utils ------------------------------ */
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const trimProto = (u?: string | null) =>
  u ? u.replace(/^https?:\/\//, "") : u;

function mask(v?: string | null, keep: number = 4) {
  if (!v) return "(empty)";
  return v.length <= keep ? "*".repeat(v.length) : v.slice(0, keep) + "…" + "*".repeat(Math.max(0, v.length - keep - 1));
}

function log(tag: string, payload: any) {
  try {
    console[ tag.startsWith("error") ? "error" : tag.startsWith("warn") ? "warn" : "log" ](
      `[API/my-shipments] ${tag}:`,
      payload
    );
  } catch { console.error(`[API/my-shipments] ${tag} raw:`, payload); }
}

function envSummary() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const svc = process.env.SUPABASE_SERVICE_ROLE || process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  const dbu = process.env.DATABASE_URL || "";
  return {
    NEXT_PUBLIC_SUPABASE_URL: url ? `${trimProto(url).split(".supabase.co")[0]}.supabase.co` : "(missing)",
    SUPABASE_SERVICE_ROLE: svc ? mask(svc) : "(missing)",
    DATABASE_URL: dbu ? (dbu.startsWith("postgres") ? "postgres(…)" : "(present)") : "(missing)",
  };
}

/* ------------------------ clients factories ----------------------- */
function supabaseAdmin(): any {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    log("warn env", envSummary());
    throw new Error("SUPABASE_ADMIN_MISCONFIG: missing url or service key");
  }
  // Cast a any per evitare mismatch di tipi "public" vs "spst"
  return createClient(url, key, {
    db: { schema: "spst" },
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { "X-Client-Info": "spst-operations/my-shipments" } },
  }) as any;
}

function makePgPool(): Pool | null {
  const cs = process.env.DATABASE_URL;
  if (!cs) return null;
  const hasParams = cs.includes("?");
  const needsSslMode = !/sslmode=/i.test(cs);
  const finalCs = hasParams ? (needsSslMode ? cs + "&sslmode=require" : cs)
                            : (needsSslMode ? cs + "?sslmode=require" : cs);
  return new Pool({
    connectionString: finalCs,
    ssl: { rejectUnauthorized: false }, // accetta self-signed (diagnostica)
    max: 2,
  });
}

const SELECT_COLS = `
  id, human_id, tipo_spedizione, incoterm,
  mittente_citta, dest_citta, giorno_ritiro,
  colli_n, peso_reale_kg, created_at
`;

/* ----------------------------- GET ------------------------------- */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const debug = url.searchParams.get("debug") === "1";
  log("warn ENV summary", envSummary());

  /* ---- Attempt A: supabase-js (schema spst) ---- */
  try {
    const sb = supabaseAdmin();

    // warmup HEAD (per forzare init schema-cache)
    const warm = await sb.from("shipments").select("id", { head: true, count: "exact" });
    if (warm?.error) log("error warmup", {
      code: warm.error.code,
      message: warm.error.message,
      details: warm.error.details,
      hint: warm.error.hint,
    });

    for (let i = 1; i <= 3; i++) {
      const { data, error } = await sb
        .from("shipments")
        .select(SELECT_COLS.replace(/\s+/g, " ").trim())
        .order("created_at", { ascending: false })
        .limit(100);

      if (!error) {
        return NextResponse.json(
          { ok: true, rows: data ?? [], source: "rest-js", debug: debug ? { tries: i } : undefined },
          { status: 200 }
        );
      }

      log(`error select (try ${i})`, {
        code: error.code, message: error.message, details: error.details, hint: error.hint,
      });

      // Retry solo per PGRST002 / schema cache
      if (String(error.code) === "PGRST002" || /schema cache/i.test(String(error.message))) {
        await sleep(600 * i);
        continue;
      }
      break;
    }
  } catch (e: any) {
    log("error bootstrap-js", { message: e?.message ?? String(e) });
  }

  /* ---- Attempt B: raw REST fetch (diagnostica cruda) ---- */
  try {
    const base = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const svc = process.env.SUPABASE_SERVICE_ROLE || process.env.SUPABASE_SERVICE_ROLE_KEY!;
    if (!base || !svc) throw new Error("RAW_REST_MISCONFIG");

    const restUrl = `${base.replace(/\/+$/,"")}/rest/v1/shipments?select=${encodeURIComponent(
      SELECT_COLS.replace(/\s+/g, " ").trim()
    )}&order=created_at.desc&limit=20`;

    const res = await fetch(restUrl, {
      method: "GET",
      headers: {
        apikey: svc,
        Authorization: `Bearer ${svc}`,
        Prefer: "count=exact",
      },
    });

    const text = await res.text();
    let payload: any = null;
    try { payload = JSON.parse(text); } catch { payload = { raw: text }; }

    if (res.ok && Array.isArray(payload)) {
      return NextResponse.json(
        { ok: true, rows: payload, source: "raw-rest", debug: debug ? { status: res.status } : undefined },
        { status: 200 }
      );
    } else {
      log("error raw-rest", {
        status: res.status,
        statusText: res.statusText,
        body: payload,
        usedUrl: restUrl.replace(base, base.includes("supabase.co") ? base.replace(/^https?:\/\//,"https://…") : "(masked)"),
      });
    }
  } catch (e: any) {
    log("error raw-rest-catch", { message: e?.message ?? String(e) });
  }

  /* ---- Attempt C: PG fallback (TLS permissivo SOLO qui) ---- */
  let client: any = null;
  const pool = makePgPool();
  if (pool) {
    // Disabilito la verifica TLS solo nel percorso PG (diagnostica)
    (globalThis as any).NODE_TLS_REJECT_UNAUTHORIZED = "0";
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
        { ok: true, rows: r.rows ?? [], source: "pg-fallback" },
        { status: 200 }
      );
    } catch (e: any) {
      log("error pg-fallback", {
        code: e?.code, message: e?.message, detail: e?.detail, name: e?.name,
      });
    } finally {
      try { client?.release?.(); } catch {}
      try { await pool.end(); } catch {}
    }
  } else {
    log("warn pg-fallback-skip", "DATABASE_URL missing");
  }

  /* ---- If all failed ---- */
  return NextResponse.json(
    { ok: false, rows: [], error: "DB_SELECT_FAILED", details: "All attempts failed (rest-js, raw-rest, pg-fallback)" },
    { status: 500 }
  );
}
