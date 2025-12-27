// FILE: app/dashboard/nuova/altro/_hooks/usePrefillMittente.ts
"use client";

import { useEffect, useRef } from "react";
import type { Party } from "@/components/nuova/PartyCard";

type Args = {
  forcedEmail?: string | null;
  setMittente: (fn: (prev: Party) => Party) => void;
};

const tag = (msg: string, ...a: any[]) =>
  console.log(`%c[prefill-mittente] ${msg}`, "color:#E33854;font-weight:600", ...a);

async function fetchImpostazioniByCookieOrForcedEmail(forcedEmail?: string | null) {
  const e = (forcedEmail ?? "").toLowerCase().trim();

  const url = e
    ? `/api/impostazioni?email=${encodeURIComponent(e)}`
    : `/api/impostazioni`;

  tag("GET", url);

  const res = await fetch(url, {
    method: "GET",
    credentials: "include",
    headers: e ? { "x-spst-email": e } : undefined,
    cache: "no-store",
  });

  const json = await res.json().catch(() => null);
  tag("RESP", { ok: res.ok, status: res.status, json });

  if (!res.ok || !json?.ok) return null;
  return json?.mittente ?? null;
}

export function usePrefillMittente({ forcedEmail, setMittente }: Args) {
  const didRunRef = useRef(false);

  useEffect(() => {
    let cancelled = false;

    if (didRunRef.current) return;
    didRunRef.current = true;

    (async () => {
      try {
        tag("start", { forcedEmail });

        const m = await fetchImpostazioniByCookieOrForcedEmail(forcedEmail);
        if (cancelled) return;

        if (!m) {
          tag("no data (mittente null)");
          return;
        }

        setMittente((prev) => {
          const next: Party = {
            ...prev,
            ragioneSociale: m.mittente || prev.ragioneSociale || "",
            indirizzo: m.indirizzo || prev.indirizzo || "",
            cap: m.cap || prev.cap || "",
            citta: m.citta || prev.citta || "",
            paese: m.paese || prev.paese || "",
            telefono: m.telefono || prev.telefono || "",
            piva: m.piva || prev.piva || "",
          };
          tag("apply", { prev, next });
          return next;
        });
      } catch (e) {
        tag("ERROR", e);
        console.error("[nuova/altro] errore prefill mittente", e);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [forcedEmail, setMittente]);
}
