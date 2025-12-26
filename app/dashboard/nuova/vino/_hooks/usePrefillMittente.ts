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

const LOG = true;
const tag = (msg: string, ...a: any[]) => {
  if (!LOG) return;
  console.log(`%c[prefill-mittente] ${msg}`, "color:#E33854;font-weight:600", ...a);
};

export function usePrefillMittente({ supabase, forcedEmail, setMittente }: Args) {
  const lastEmailRef = useRef<string | null>(null);
  const ranRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    tag("mount", { forcedEmail });

    const run = async (rawEmail: string, source: "forced" | "getUser" | "authChange") => {
      const email = (rawEmail || "").toLowerCase().trim();
      tag("run()", { source, rawEmail, email });

      if (!email) {
        tag("skip: empty email", { source });
        return;
      }
      if (lastEmailRef.current === email) {
        tag("skip: same email as last", { email, source });
        return;
      }
      lastEmailRef.current = email;

      try {
        tag("fetchImpostazioniMittente → start", { email });
        const m = await fetchImpostazioniMittente(email);
        tag("fetchImpostazioniMittente → done", { email, ok: !!m, m });

        if (cancelled) {
          tag("cancelled after fetch", { email });
          return;
        }
        if (!m) {
          tag("no mittente data returned", { email });
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
          tag("setMittente()", { email, prev, next });
          return next;
        });
      } catch (e) {
        tag("ERROR in run()", { email, source, e });
        console.error("[nuova/vino] errore prefill mittente", e);
      }
    };

    // 1) forcedEmail ha priorità assoluta
    if (forcedEmail && forcedEmail.trim()) {
      tag("forcedEmail present → run(forced)");
      run(forcedEmail, "forced");
    } else {
      tag("no forcedEmail → try getUser()");
      (async () => {
        try {
          const { data, error } = await supabase.auth.getUser();
          tag("getUser() result", { hasUser: !!data?.user, email: data?.user?.email, error });

          const email = data?.user?.email || "";
          if (email) await run(email, "getUser");
          else tag("getUser() empty email → waiting authChange");
        } catch (e) {
          tag("ERROR getUser()", { e });
          console.error("[nuova/vino] errore getUser prefill mittente", e);
        }
      })();
    }

    // 2) retry quando cambia auth/session
    tag("subscribe onAuthStateChange()");
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      tag("onAuthStateChange()", {
        event,
        hasSession: !!session,
        email: session?.user?.email,
      });

      const email = session?.user?.email || "";
      if (email) run(email, "authChange");
    });

    // 3) watchdog: se dopo 2s non è mai partito davvero, logga lo stato
    const t = window.setTimeout(async () => {
      if (cancelled) return;
      if (!ranRef.current && !forcedEmail) {
        try {
          const { data } = await supabase.auth.getSession();
          tag("watchdog (2s): session snapshot", {
            hasSession: !!data?.session,
            email: data?.session?.user?.email,
          });
        } catch (e) {
          tag("watchdog ERROR getSession()", { e });
        }
      }
    }, 2000);

    return () => {
      cancelled = true;
      window.clearTimeout(t);
      tag("unmount → unsubscribe");
      sub?.subscription?.unsubscribe?.();
    };
  }, [forcedEmail, setMittente, supabase]);
}
