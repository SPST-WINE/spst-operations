// FILE: app/dashboard/nuova/vino/_hooks/usePrefillMittente.ts
"use client";

import { useEffect, useRef } from "react";
import type { Party } from "@/components/nuova/PartyCard";
import { fetchImpostazioniMittente } from "../_services/impostazioni.client";

type Args = {
  forcedEmail?: string | null;
  setMittente: (fn: (prev: Party) => Party) => void;
};

const tag = (msg: string, ...a: any[]) =>
  console.log(`%c[prefill-mittente] ${msg}`, "color:#E33854;font-weight:600", ...a);

export function usePrefillMittente({ forcedEmail, setMittente }: Args) {
  const lastEmailRef = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const run = async (email?: string | null, source: "forced" | "cookie") => {
      const e = (email ?? "").toLowerCase().trim() || null;
      tag("run()", { source, email: e });

      if (e && lastEmailRef.current === e) return;
      if (e) lastEmailRef.current = e;

      const m = await fetchImpostazioniMittente(e); // 👈 null = usa cookie lato API
      tag("fetchImpostazioniMittente result", { has: !!m, m });

      if (!m || cancelled) return;

      setMittente((prev) => ({
        ...prev,
        ragioneSociale: m.mittente || prev.ragioneSociale || "",
        indirizzo: m.indirizzo || prev.indirizzo || "",
        cap: m.cap || prev.cap || "",
        citta: m.citta || prev.citta || "",
        paese: m.paese || prev.paese || "",
        telefono: m.telefono || prev.telefono || "",
        piva: m.piva || prev.piva || "",
      }));
    };

    // 1) forcedEmail se presente
    if (forcedEmail && forcedEmail.trim()) {
      run(forcedEmail, "forced");
    } else {
      // 2) altrimenti usa cookie lato API
      run(null, "cookie");
    }

    return () => {
      cancelled = true;
    };
  }, [forcedEmail, setMittente]);
}
