// app/dashboard/impostazioni/page.tsx
"use client";

import { useEffect, useState } from "react";

type ShipperDefaults = {
  paese: string;
  mittente: string;
  citta: string;
  cap: string;
  indirizzo: string;
  telefono: string;
  piva: string;
};

export default function ImpostazioniPage() {
  const [email, setEmail] = useState<string>("-");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [form, setForm] = useState<ShipperDefaults>({
    paese: "",
    mittente: "",
    citta: "",
    cap: "",
    indirizzo: "",
    telefono: "",
    piva: "",
  });

  // comodo per costruire la query ?email=
  const getEmailNorm = () => {
    const raw = (email || "").trim();
    return raw ? raw.toLowerCase() : "";
  };

  useEffect(() => {
    let alive = true;

    async function load() {
      setLoading(true);
      setErrorMsg(null);
      setStatusMsg(null);

      try {
        // 1) prendo l’email dal profilo (stub per ora: info@spst.it)
        const profRes = await fetch("/api/profile", { cache: "no-store" });
        const profBody = await profRes.json().catch(() => ({}));
        const emailFromProfile: string =
          profBody?.profile?.email?.toString?.() || "";

        if (!emailFromProfile) {
          console.warn("SPST[impostazioni] profile senza email:", profBody);
          if (alive) {
            setErrorMsg(
              "Impossibile recuperare l'email del profilo. Contatta SPST."
            );
          }
          return;
        }

        if (!alive) return;

        setEmail(emailFromProfile);

        const emailNorm = emailFromProfile.trim().toLowerCase();

        // 2) chiamo /api/impostazioni con ?email=
        const res = await fetch(
          `/api/impostazioni?email=${encodeURIComponent(emailNorm)}`,
          {
            method: "GET",
            cache: "no-store",
          }
        );

        const body = await res.json().catch(() => ({}));

        console.log("SPST[impostazioni] GET response:", {
          status: res.status,
          body,
        });

        if (!alive) return;

        if (res.ok && body?.ok) {
          const m = body.mittente || {};
          setForm({
            paese: m.paese || "",
            mittente: m.mittente || "",
            citta: m.citta || "",
            cap: m.cap || "",
            indirizzo: m.indirizzo || "",
            telefono: m.telefono || "",
            piva: m.piva || "",
          });
        } else {
          setErrorMsg(
            body?.error || "Errore nel caricamento delle impostazioni."
          );
        }
      } catch (e: any) {
        console.error("SPST[impostazioni] GET error:", e);
        if (alive)
          setErrorMsg("Errore di rete nel caricamento delle impostazioni.");
      } finally {
        if (alive) setLoading(false);
      }
    }

    load();
    return () => {
      alive = false;
    };
  }, []);

  const updateField = (key: keyof ShipperDefaults, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setStatusMsg(null);
    setErrorMsg(null);

    try {
      const emailNorm = getEmailNorm();
      if (!emailNorm) {
        setErrorMsg(
          "Email non disponibile. Ricarica la pagina o contatta SPST."
        );
        setSaving(false);
        return;
      }

      const res = await fetch(
        `/api/impostazioni?email=${encodeURIComponent(emailNorm)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mittente: form }),
        }
      );

      const body = await res.json().catch(() => ({}));

      console.log("SPST[impostazioni] POST response:", {
        status: res.status,
        body,
      });

      if (res.ok && body?.ok) {
        setStatusMsg("Impostazioni salvate correttamente.");
      } else {
        setErrorMsg(body?.error || "Errore durante il salvataggio.");
      }
    } catch (e: any) {
      console.error("SPST[impostazioni] POST error:", e);
      setErrorMsg("Errore di rete durante il salvataggio.");
    } finally {
      setSaving(false);
    }
  };

  // qui sotto immagino tu abbia già il JSX (form) – lo lascio invariato
  // ...

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Impostazioni</h1>
        <p className="mt-1 text-sm text-slate-500">
          Configura i dati predefiniti del mittente per le tue spedizioni.
        </p>
      </div>

      {/* Card email + form, come avevi già strutturato */}
      {/* Usa `email`, `form`, `updateField`, `onSubmit`, `loading`, `saving`,
          `statusMsg` ed `errorMsg` nella UI esistente */}
      {/* ... */}
    </div>
  );
}
