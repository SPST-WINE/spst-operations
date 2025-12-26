// FILE: app/dashboard/nuova/vino/_services/shipments.client.ts
"use client";

import type { SupabaseClient } from "@supabase/supabase-js";

export async function createShipmentWithAuth(
  supabase: SupabaseClient,
  payload: any,
  emailOverride?: string
) {
  const body: any = {
    ...payload,
    ...(emailOverride ? { email_cliente: emailOverride.toLowerCase().trim() } : {}),
  };

  // prova token (se esiste), ma NON è richiesto
  let accessToken: string | undefined;
  try {
    const { data } = await supabase.auth.getSession();
    accessToken = data?.session?.access_token;
  } catch {}

  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;

  const res = await fetch("/api/spedizioni", {
    method: "POST",
    headers,
    credentials: "include", // ✅ qui sta la sessione vera
    body: JSON.stringify(body),
  });

  const json = await res.json().catch(() => ({} as any));
  if (!res.ok || !json?.ok) {
    const details = json?.details || json?.error || `${res.status} ${res.statusText}`;
    throw new Error(typeof details === "string" ? details : "Errore creazione spedizione. Riprova.");
  }

  const recId = json?.shipment?.id;
  const humanId = json?.id || json?.shipment?.human_id;

  if (!recId || !humanId) throw new Error("Missing id from /api/spedizioni response");

  return { recId, humanId };
}
