// FILE: app/dashboard/nuova/vino/_services/upload.client.ts
"use client";

import type { DocType } from "../_logic/types";

export async function uploadShipmentDocument(
  shipmentId: string,
  file: File,
  docType: DocType
) {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("type", docType);

  const res = await fetch(
    `/api/spedizioni/${encodeURIComponent(shipmentId)}/upload`,
    {
      method: "POST",
      body: formData,
    }
  );

  const json = await res.json().catch(() => null);

  if (!res.ok || !json?.ok) {
    const msg =
      json?.error || `${res.status} ${res.statusText}` || "Errore upload file";
    console.error("[uploadShipmentDocument] error:", msg, json);
    throw new Error(msg);
  }

  return { url: json.url as string | undefined };
}
