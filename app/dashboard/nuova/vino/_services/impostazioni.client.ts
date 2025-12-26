// FILE: app/dashboard/nuova/vino/_services/impostazioni.client.ts
"use client";

const LOG = true;
const tag = (msg: string, ...a: any[]) => {
  if (!LOG) return;
  console.log(`%c[impostazioni.client] ${msg}`, "color:#1C3E5D;font-weight:600", ...a);
};

export async function fetchImpostazioniMittente(email: string) {
  const e = (email || "").toLowerCase().trim();
  if (!e) return null;

  const url = `/api/impostazioni?email=${encodeURIComponent(e)}`;
  tag("GET", url);

  const res = await fetch(url, {
    headers: { "x-spst-email": e },
    cache: "no-store",
  });

  const json = await res.json().catch(() => null);
  tag("RESP", { ok: res.ok, status: res.status, json });

  if (!res.ok || !json?.ok) return null;

  // atteso: { ok:true, mittente:{ ... } }
  return json?.mittente ?? null;
}
