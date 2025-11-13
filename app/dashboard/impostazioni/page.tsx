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

  useEffect(() => {
    let alive = true;

    async function load() {
      setLoading(true);
      setErrorMsg(null);
      setStatusMsg(null);
      try {
        const res = await fetch("/api/impostazioni", {
          method: "GET",
          cache: "no-store",
        });
        const body = await res.json().catch(() => ({}));

        console.log("SPST[impostazioni] GET response:", { status: res.status, body });

        if (!alive) return;

        if (res.ok && body?.ok) {
          setEmail(body.email || "-");
          const s = body.shipper || {};
          setForm({
            paese: s.paese || "",
            mittente: s.mittente || "",
            citta: s.citta || "",
            cap: s.cap || "",
            indirizzo: s.indirizzo || "",
            telefono: s.telefono || "",
            piva: s.piva || "",
          });
        } else {
          setErrorMsg(body?.error || "Errore nel caricamento delle impostazioni.");
        }
      } catch (e: any) {
        console.error("SPST[impostazioni] GET error:", e);
        if (alive) setErrorMsg("Errore di rete nel caricamento delle impostazioni.");
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
      const res = await fetch("/api/impostazioni", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const body = await res.json().catch(() => ({}));

      console.log("SPST[impostazioni] POST response:", { status: res.status, body });

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

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-slate-800">Impostazioni</h1>

      {/* Email account */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-800 mb-3">
          Email account
        </h2>
        <label className="block text-xs font-medium text-slate-500 mb-1">
          Email
        </label>
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

      {/* Impostazioni mittente */}
      <form
        onSubmit={onSubmit}
        className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-4"
      >
        <h2 className="text-sm font-semibold text-slate-800 mb-1">
          Impostazioni mittente
        </h2>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">
              Paese
            </label>
            <input
              type="text"
              placeholder="IT, FR, ES…"
              value={form.paese}
              onChange={(e) => updateField("paese", e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">
              Mittente
            </label>
            <input
              type="text"
              placeholder="Ragione sociale / Nome"
              value={form.mittente}
              onChange={(e) => updateField("mittente", e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">
              Città
            </label>
            <input
              type="text"
              value={form.citta}
              onChange={(e) => updateField("citta", e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">
              CAP
            </label>
            <input
              type="text"
              value={form.cap}
              onChange={(e) => updateField("cap", e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-slate-500 mb-1">
              Indirizzo
            </label>
            <input
              type="text"
              placeholder="Via / Piazza e numero civico"
              value={form.indirizzo}
              onChange={(e) => updateField("indirizzo", e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">
              Telefono
            </label>
            <input
              type="text"
              placeholder="+39 320 000 0000"
              value={form.telefono}
              onChange={(e) => updateField("telefono", e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">
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

          {loading && (
            <span className="text-xs text-slate-400">
              Caricamento impostazioni…
            </span>
          )}
          {statusMsg && !errorMsg && (
            <span className="text-xs text-emerald-600">{statusMsg}</span>
          )}
          {errorMsg && (
            <span className="text-xs text-rose-600">{errorMsg}</span>
          )}
        </div>
      </form>
    </div>
  );
}
