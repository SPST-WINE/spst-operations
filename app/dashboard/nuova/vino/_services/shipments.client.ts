// FILE: app/dashboard/nuova/vino/_services/shipments.client.ts
"use client";

import type { SupabaseClient } from "@supabase/supabase-js";

function getCookie(name: string) {
  if (typeof document === "undefined") return null;
  const m = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return m ? decodeURIComponent(m[1]) : null;
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

  // 1) prova session token via supabase-js (se c'è)
  let accessToken: string | undefined;
  try {
    const { data } = await supabase.auth.getSession();
    accessToken = data?.session?.access_token;
  } catch {}

  // 2) fallback: token cookie (tipico con @supabase/ssr)
  if (!accessToken) {
    const c = getCookie("sb-access-token");
    if (c) accessToken = c;
  }

  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;

  const res = await fetch("/api/spedizioni", {
    method: "POST",
    headers,
    credentials: "include",
    body: JSON.stringify(body),
  });

  const json = await res.json().catch(() => ({} as any));
  if (!res.ok || !json?.ok) {
    const details = json?.details || json?.error || `${res.status} ${res.statusText}`;
    throw new Error(
      typeof details === "string" ? details : "Errore creazione spedizione. Riprova."
    );
  }

  const recId = json?.shipment?.id;
  const humanId = json?.id || json?.shipment?.human_id;

  if (!recId || !humanId) throw new Error("Missing id from /api/spedizioni response");

  return { recId, humanId };
}
