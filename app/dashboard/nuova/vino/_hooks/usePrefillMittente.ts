// FILE: app/dashboard/nuova/vino/_hooks/usePrefillMittente.ts
"use client";

import { useEffect, useRef } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Party } from "@/components/nuova/PartyCard";
import { fetchImpostazioniMittente } from "../_services/impostazioni.client";

type Args = {
  supabase: SupabaseClient;
  forcedEmail?: string | null;
  setMittente: (fn: (prev: Party) => Party) => void;
};

export function usePrefillMittente({ supabase, forcedEmail, setMittente }: Args) {
  const lastEmailRef = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const run = async (email: string) => {
      const effectiveEmail = (email || "").toLowerCase().trim();
      if (!effectiveEmail) return;
      if (lastEmailRef.current === effectiveEmail) return; // evita doppie chiamate
      lastEmailRef.current = effectiveEmail;

      try {
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
    };

    // 1) se forcedEmail esiste → usa quella e stop
    if (forcedEmail && forcedEmail.trim()) {
      run(forcedEmail);
      return () => {
        cancelled = true;
      };
    }

    // 2) prova subito
    (async () => {
      try {
        const { data } = await supabase.auth.getUser();
        const email = data?.user?.email || "";
        if (email) await run(email);
      } catch (e) {
        console.error("[nuova/vino] errore getUser prefill mittente", e);
      }
    })();

    // 3) retry quando arriva la sessione (fix definitivo)
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      const email = session?.user?.email || "";
      if (email) run(email);
    });

    return () => {
      cancelled = true;
      sub?.subscription?.unsubscribe?.();
    };
  }, [forcedEmail, setMittente, supabase]);
}
