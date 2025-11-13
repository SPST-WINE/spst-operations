// app/api/impostazioni/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { cookies, headers as nextHeaders } from "next/headers";

/* ───────────── Helpers ───────────── */

function getAccessTokenFromRequest() {
  const hdrs = nextHeaders();
  const auth = hdrs.get("authorization") || hdrs.get("Authorization") || "";
  if (auth.startsWith("Bearer ")) return auth.slice(7).trim();

  const jar = cookies();
  const sb = jar.get("sb-access-token")?.value;
  if (sb) return sb;

  const supaCookie = jar.get("supabase-auth-token")?.value; // JSON string
  if (supaCookie) {
    try {
      const arr = JSON.parse(supaCookie);
      if (Array.isArray(arr) && arr[0]) return arr[0];
    } catch {
      // ignore
    }
  }
  return null;
}

function normalizeEmail(x?: string | null) {
  const v = (x ?? "").trim();
  return v ? v.toLowerCase() : null;
}

function cleanString(x: any): string | null {
  if (x === null || x === undefined) return null;
  const s = String(x).trim();
  return s === "" ? null : s;
}

/* ───────────── Next config ───────────── */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

/* ───────────── Common client factory ───────────── */

function getSupabaseClients() {
  const SUPABASE_URL =
    process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const SUPABASE_SERVICE_ROLE_KEY =
    process.env.SUPABASE_SERVICE_ROLE || process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY."
    );
  }
  if (!SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Missing SUPABASE_SERVICE_ROLE (or SUPABASE_SERVICE_ROLE_KEY).");
  }

  const supabaseAuth = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false },
  });
  const supabaseSrv = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  return { supabaseAuth, supabaseSrv };
}

/* ───────────── GET /api/impostazioni ───────────── */

export async function GET(_req: Request) {
  try {
    const accessToken = getAccessTokenFromRequest();
    if (!accessToken) {
      return NextResponse.json(
        { ok: false, error: "NO_TOKEN" },
        { status: 401 }
      );
    }

    const { supabaseAuth } = getSupabaseClients();

    const { data, error } = await supabaseAuth.auth.getUser(accessToken);

    if (error || !data?.user) {
      console.error("[API/impostazioni:GET] getUser error:", error);
      return NextResponse.json(
        { ok: false, error: "INVALID_USER" },
        { status: 401 }
      );
    }

    const user = data.user;
    const email = user.email ?? null;
    const email_norm = normalizeEmail(email);

    const meta = (user.user_metadata || {}) as any;
    const shipper = (meta.shipper_defaults || {}) as any;

    return NextResponse.json({
      ok: true,
      email,
      email_norm,
      shipper: {
        paese: shipper.paese ?? null,
        mittente: shipper.mittente ?? null,
        citta: shipper.citta ?? null,
        cap: shipper.cap ?? null,
        indirizzo: shipper.indirizzo ?? null,
        telefono: shipper.telefono ?? null,
        piva: shipper.piva ?? null,
      },
    });
  } catch (e: any) {
    console.error("[API/impostazioni:GET] unexpected:", e);
    return NextResponse.json(
      { ok: false, error: "UNEXPECTED", details: String(e?.message || e) },
      { status: 500 }
    );
  }
}

/* ───────────── POST /api/impostazioni ───────────── */

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({} as any));
    const accessToken = getAccessTokenFromRequest();
    if (!accessToken) {
      return NextResponse.json(
        { ok: false, error: "NO_TOKEN" },
        { status: 401 }
      );
    }

    const { supabaseAuth, supabaseSrv } = getSupabaseClients();

    const { data, error } = await supabaseAuth.auth.getUser(accessToken);

    if (error || !data?.user) {
      console.error("[API/impostazioni:POST] getUser error:", error);
      return NextResponse.json(
        { ok: false, error: "INVALID_USER" },
        { status: 401 }
      );
    }

    const user = data.user;

    const nuovoShipper = {
      paese: cleanString(body.paese),
      mittente: cleanString(body.mittente),
      citta: cleanString(body.citta),
      cap: cleanString(body.cap),
      indirizzo: cleanString(body.indirizzo),
      telefono: cleanString(body.telefono),
      piva: cleanString(body.piva),
    };

    const metaPrev = (user.user_metadata || {}) as any;

    const { error: updErr } = await supabaseSrv.auth.admin.updateUserById(
      user.id,
      {
        user_metadata: {
          ...metaPrev,
          shipper_defaults: nuovoShipper,
        },
      }
    );

    if (updErr) {
      console.error("[API/impostazioni:POST] updateUserById error:", updErr);
      return NextResponse.json(
        { ok: false, error: "UPDATE_FAILED", details: updErr.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error("[API/impostazioni:POST] unexpected:", e);
    return NextResponse.json(
      { ok: false, error: "UNEXPECTED", details: String(e?.message || e) },
      { status: 500 }
    );
  }
}
