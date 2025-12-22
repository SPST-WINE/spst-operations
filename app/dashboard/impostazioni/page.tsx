// app/dashboard/impostazioni/page.tsx
"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

export const dynamic = "force-dynamic";

type ShipperDefaults = {
  paese: string;
  mittente: string;
  citta: string;
  cap: string;
  indirizzo: string;
  telefono: string;
  piva: string;
};

type Status = "idle" | "loading" | "saving";

export default function ImpostazioniPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-4">
          <h1 className="text-xl font-semibold text-slate-800">Impostazioni</h1>
          <div className="text-sm text-slate-500">Caricamento…</div>
        </div>
      }
    >
      <ImpostazioniPageInner />
    </Suspense>
  );
}

function ImpostazioniPageInner() {
  const sp = useSearchParams();
  const onboarding = sp.get("onboarding") === "1";

  const [email, setEmail] = useState<string>("-");
  const [form, setForm] = useState<ShipperDefaults>({
    paese: "",
    mittente: "",
    citta: "",
    cap: "",
    indirizzo: "",
    telefono: "",
    piva: "",
  });

  const [status, setStatus] = useState<Status>("loading");
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const loading = status === "loading";
  const saving = status === "saving";

  useEffect(() => {
    let alive = true;

    async function load() {
      setStatus("loading");
      setStatusMsg(null);
      setErrorMsg(null);

      try {
        // 1) profilo dal server (Supabase auth)
        const profRes = await fetch("/api/profile", { cache: "no-store" });
        const profBody = await profRes.json().catch(() => ({}));
        const profileEmail: string = profBody?.profile?.email?.toString?.() || "";

        if (!alive) return;

        if (!profileEmail) {
          setErrorMsg("Impossibile recuperare l'email. Fai login e riprova.");
          setStatus("idle");
          return;
        }

        setEmail(profileEmail);

        // 2) self-service: niente ?email=
        const res = await fetch(`/api/impostazioni`, {
          method: "GET",
          cache: "no-store",
        });
        const body = await res.json().catch(() => ({}));

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
            body?.message ||
              body?.error ||
              "Errore nel caricamento delle impostazioni."
          );
        }
      } catch (e: any) {
        if (alive) setErrorMsg("Errore di rete nel caricamento delle impostazioni.");
      } finally {
        if (alive) setStatus("idle");
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
    setStatus("saving");
    setStatusMsg(null);
    setErrorMsg(null);

    try {
      const res = await fetch(`/api/impostazioni`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mittente: form }),
      });
      const body = await res.json().catch(() => ({}));

      if (res.ok && body?.ok) {
        setStatusMsg("Impostazioni salvate correttamente.");
      } else {
        setErrorMsg(body?.message || body?.error || "Errore durante il salvataggio.");
      }
    } catch (e: any) {
      setErrorMsg("Errore di rete durante il salvataggio.");
    } finally {
      setStatus("idle");
    }
  };

  return (
    <div className="space-y-6">
      {onboarding ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-900">
          <div className="font-semibold">Completa il mittente</div>
          <div className="mt-1 text-amber-800">
            Completa i dati del mittente per iniziare a spedire.
          </div>
        </div>
      ) : null}

      <div>
        <h1 className="text-xl font-semibold text-slate-800">Impostazioni</h1>
        <p className="mt-1 text-sm text-slate-500">
          Configura i dati predefiniti del mittente per le tue spedizioni.
        </p>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold text-slate-800">Email account</h2>
        <label className="mb-1 block text-xs font-medium text-slate-500">Email</label>
        <input
          type="email"
          value={email}
          disabled
          className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700"
        />
        <p className="mt-1 text-xs text-slate-400">
          L&apos;email identifica il tuo profilo e non è modificabile da questa pagina.
        </p>
      </div>

      <form
        onSubmit={onSubmit}
        className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
      >
        <h2 className="mb-1 text-sm font-semibold text-slate-800">Impostazioni mittente</h2>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Paese</label>
            <input
              type="text"
              placeholder="IT, FR, ES…"
              value={form.paese}
              onChange={(e) => updateField("paese", e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Mittente</label>
            <input
              type="text"
              placeholder="Ragione sociale / Nome"
              value={form.mittente}
              onChange={(e) => updateField("mittente", e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Città</label>
            <input
              type="text"
              value={form.citta}
              onChange={(e) => updateField("citta", e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">CAP</label>
            <input
              type="text"
              value={form.cap}
              onChange={(e) => updateField("cap", e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="mb-1 block text-xs font-medium text-slate-500">Indirizzo</label>
            <input
              type="text"
              placeholder="Via / Piazza e numero civico"
              value={form.indirizzo}
              onChange={(e) => updateField("indirizzo", e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Telefono</label>
            <input
              type="text"
              placeholder="+39 320 000 0000"
              value={form.telefono}
              onChange={(e) => updateField("telefono", e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">
              Partita IVA / CF
            </label>
            <input
              type="text"
              placeholder="IT01234567890"
              value={form.piva}
              onChange={(e) => updateField("piva", e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
          </div>
        </div>

        <div className="flex items-center gap-3 pt-2">
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center rounded-lg bg-[#1c3e5e] px-4 py-2 text-sm font-medium text-white hover:opacity-95 disabled:opacity-60"
          >
            {saving ? "Salvataggio..." : "Salva"}
          </button>

          {loading && <span className="text-xs text-slate-400">Caricamento…</span>}
          {statusMsg && !errorMsg && <span className="text-xs text-emerald-600">{statusMsg}</span>}
          {errorMsg && <span className="text-xs text-rose-600">{errorMsg}</span>}
        </div>
      </form>
    </div>
  );
}
