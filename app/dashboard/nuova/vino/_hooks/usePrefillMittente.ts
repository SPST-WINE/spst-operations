// FILE: app/dashboard/nuova/vino/_hooks/usePrefillMittente.ts
"use client";

import { useEffect } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Party } from "@/components/nuova/PartyCard";
import { fetchImpostazioniMittente } from "../_services/impostazioni.client";

type Args = {
  supabase: SupabaseClient;
  forcedEmail?: string | null;
  setMittente: (fn: (prev: Party) => Party) => void;
};

export function usePrefillMittente({ supabase, forcedEmail, setMittente }: Args) {
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        const effectiveEmail =
          forcedEmail?.toLowerCase().trim() ||
          user?.email?.toLowerCase().trim() ||
          "";

        if (!effectiveEmail) return;

        const m = await fetchImpostazioniMittente(effectiveEmail);
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
      } catch (e) {
        console.error("[nuova/vino] errore prefill mittente", e);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [forcedEmail, setMittente, supabase]);
}
