// FILE: app/dashboard/nuova/vino/_services/shipments.client.ts
"use client";

import type { SupabaseClient } from "@supabase/supabase-js";

const LOG = true;
const log = (...a: any[]) => LOG && console.log("%c[SHIPMENTS]", "color:#1C3E5D;font-weight:700", ...a);
const warn = (...a: any[]) => LOG && console.warn("[SHIPMENTS]", ...a);

function getCookie(name: string) {
  if (typeof document === "undefined") return null;
  const m = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return m ? decodeURIComponent(m[1]) : null;
}

function maskTok(t?: string | null) {
  if (!t) return null;
  if (t.length <= 18) return `${t.slice(0, 3)}…${t.slice(-3)}`;
  return `${t.slice(0, 10)}…${t.slice(-8)}`;
}

export async function createShipmentWithAuth(
  supabase: SupabaseClient,
  payload: any,
  emailOverride?: string
) {
  const body: any = {
    ...payload,
    ...(emailOverride ? { email_cliente: emailOverride.toLowerCase().trim() } : {}),
  };

  log("start", {
    hasEmailOverride: !!emailOverride,
    emailOverride: emailOverride ? emailOverride.toLowerCase().trim() : null,
    payloadKeys: Object.keys(payload || {}),
  });

  // 1) prova session token via supabase-js
  let accessToken: string | undefined;
  try {
    const { data, error } = await supabase.auth.getSession();
    accessToken = data?.session?.access_token;
    log("supabase.getSession()", {
      hasSession: !!data?.session,
      sessionUserEmail: data?.session?.user?.email ?? null,
      error: error ? { name: (error as any).name, message: (error as any).message } : null,
      token: maskTok(accessToken),
    });
  } catch (e: any) {
    warn("supabase.getSession() threw", e?.message || e);
  }

  // 2) fallback: cookie token
  const cookieAccess = getCookie("sb-access-token");
  const cookieRefresh = getCookie("sb-refresh-token");
  log("cookies", {
    hasSbAccess: !!cookieAccess,
    hasSbRefresh: !!cookieRefresh,
    sbAccess: maskTok(cookieAccess),
    sbRefresh: maskTok(cookieRefresh),
  });

  if (!accessToken && cookieAccess) accessToken = cookieAccess;

  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;

  log("POST /api/spedizioni headers", {
    hasAuthHeader: !!headers.Authorization,
    authHeader: headers.Authorization ? `Bearer ${maskTok(accessToken)}` : null,
    credentials: "include",
  });

  const res = await fetch("/api/spedizioni", {
    method: "POST",
    headers,
    credentials: "include",
    body: JSON.stringify(body),
  });

  const rawText = await res.text().catch(() => "");
  let json: any = null;
  try {
    json = rawText ? JSON.parse(rawText) : null;
  } catch {
    json = { _raw: rawText };
  }

  log("response", {
    ok: res.ok,
    status: res.status,
    statusText: res.statusText,
    json,
  });

  if (!res.ok || !json?.ok) {
    const details = json?.details || json?.error || `${res.status} ${res.statusText}`;
    throw new Error(typeof details === "string" ? details : "Errore creazione spedizione. Riprova.");
  }

  const recId = json?.shipment?.id;
  const humanId = json?.id || json?.shipment?.human_id;

  if (!recId || !humanId) throw new Error("Missing id from /api/spedizioni response");

  return { recId, humanId };
}
