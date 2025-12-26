// FILE: app/dashboard/nuova/vino/_services/impostazioni.client.ts
"use client";

export async function fetchImpostazioniMittente(email: string) {
  const effectiveEmail = email.toLowerCase().trim();
  if (!effectiveEmail) return null;

  const res = await fetch(`/api/impostazioni?email=${encodeURIComponent(effectiveEmail)}`, {
    headers: { "x-spst-email": effectiveEmail },
    cache: "no-store",
  });

  const json = await res.json().catch(() => null);
  if (!json?.ok || !json?.mittente) return null;
  return json.mittente as any;
}
