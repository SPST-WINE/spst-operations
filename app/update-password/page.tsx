// app/update-password/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type Status = "loading" | "idle" | "saving" | "success" | "error";

export default function UpdatePasswordPage() {
  const router = useRouter();
  const [status, setStatus] = useState<Status>("loading");
  const [error, setError] = useState<string | null>(null);

  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");

  useEffect(() => {
    // verifica che ci sia una sessione recovery valida
    (async () => {
      setStatus("loading");
      const { data, error } = await supabase.auth.getSession();
      if (error || !data.session) {
        setStatus("error");
        setError(
          "Link non valido o scaduto. Richiedi nuovamente la reimpostazione della password."
        );
        return;
      }
      setStatus("idle");
    })();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) {
      setError("La password deve contenere almeno 8 caratteri.");
      return;
    }
    if (password !== passwordConfirm) {
      setError("Le password non coincidono.");
      return;
    }

    setStatus("saving");
    setError(null);

    const { error } = await supabase.auth.updateUser({
      password,
    });

    if (error) {
      setStatus("error");
      setError(error.message || "Errore durante l’aggiornamento della password.");
      return;
    }

    setStatus("success");
    // dopo qualche secondo vai al login
    setTimeout(() => {
      router.push("/login");
    }, 2000);
  }

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <p className="text-sm text-slate-600">Verifica del link in corso…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-sm border border-slate-200 p-8">
        <div className="flex flex-col items-center mb-6">
          <div className="mb-3">
            <Image
              src="/logo/png-spst-logo.png"
              alt="SPST"
              width={48}
              height={48}
              className="h-12 w-12 object-contain"
            />
          </div>
          <h1 className="text-xl font-semibold text-slate-900">
            Imposta una nuova password
          </h1>
          <p className="mt-1 text-sm text-slate-500 text-center">
            Scegli una nuova password per il tuo account SPST.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label
              htmlFor="password"
              className="block text-sm font-medium text-slate-700"
            >
              Nuova password
            </label>
            <input
              id="password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#1c3e5e] focus:ring-1 focus:ring-[#1c3e5e]"
              placeholder="••••••••"
            />
          </div>

          <div className="space-y-2">
            <label
              htmlFor="passwordConfirm"
              className="block text-sm font-medium text-slate-700"
            >
              Conferma password
            </label>
            <input
              id="passwordConfirm"
              type="password"
              required
              value={passwordConfirm}
              onChange={(e) => setPasswordConfirm(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#1c3e5e] focus:ring-1 focus:ring-[#1c3e5e]"
              placeholder="••••••••"
            />
          </div>

          {error && (
            <p className="text-xs text-rose-600 bg-rose-50 border border-rose-100 rounded-md px-3 py-2">
              {error}
            </p>
          )}

          {status === "success" && (
            <p className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-md px-3 py-2">
              Password aggiornata correttamente. Verrai reindirizzato al login…
            </p>
          )}

          <button
            type="submit"
            disabled={status === "saving" || status === "success"}
            className="w-full rounded-lg bg-[#1c3e5e] text-white text-sm font-medium py-2.5 mt-1 hover:opacity-95 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {status === "saving" ? "Salvataggio…" : "Salva nuova password"}
          </button>
        </form>
      </div>
    </div>
  );
}
