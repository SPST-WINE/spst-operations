// app/signup/page.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { supabaseBrowser } from "@/lib/supabase/browser";

type Status = "idle" | "loading" | "success" | "error";

export default function SignupPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const isLoading = status === "loading";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (isLoading) return;

    setStatus("loading");
    setError(null);
    setInfo(null);

    try {
      const supabase = supabaseBrowser();

      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
      });

      if (error) {
        setStatus("error");
        setError(error.message || "Errore durante la registrazione.");
        return;
      }

      setStatus("success");

      // Se email confirmation è ON, spesso non hai session immediata.
      // Messaggio chiaro e redirect al login.
      if (!data.session) {
        setInfo(
          "Registrazione completata. Controlla la tua email per confermare l’account, poi effettua il login."
        );
        return;
      }

      // Se confirmation OFF → sei già loggato
      router.push("/dashboard/spedizioni");
    } catch (err: any) {
      setStatus("error");
      setError(err?.message || "Errore imprevisto durante la registrazione.");
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-sm border border-slate-200 p-8">
        {/* Logo */}
        <div className="flex flex-col items-center mb-6">
          <div className="mb-3">
            <Image
              src="/spst-logo.png"
              alt="SPST"
              width={64}
              height={64}
              className="h-16 w-16 object-contain"
              priority
            />
          </div>
          <h1 className="text-xl font-semibold text-slate-900">
            Crea il tuo account
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Registrati per accedere al portale SPST
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label
              htmlFor="email"
              className="block text-sm font-medium text-slate-700"
            >
              Email
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#1c3e5e] focus:ring-1 focus:ring-[#1c3e5e]"
              placeholder="info@azienda.it"
            />
          </div>

          <div className="space-y-2">
            <label
              htmlFor="password"
              className="block text-sm font-medium text-slate-700"
            >
              Password
            </label>
            <input
              id="password"
              type="password"
              autoComplete="new-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#1c3e5e] focus:ring-1 focus:ring-[#1c3e5e]"
              placeholder="Min. 8 caratteri"
            />
          </div>

          {error ? (
            <p className="text-xs text-rose-600 bg-rose-50 border border-rose-100 rounded-md px-3 py-2">
              {error}
            </p>
          ) : null}

          {info ? (
            <p className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-md px-3 py-2">
              {info}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full rounded-lg bg-[#1c3e5e] text-white text-sm font-medium py-2.5 mt-2 hover:opacity-95 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {isLoading ? "Creazione account…" : "Registrati"}
          </button>
        </form>

        <div className="mt-4 flex items-center justify-between text-xs">
          <a href="/login" className="text-[#1c3e5e] hover:underline">
            Hai già un account? Accedi
          </a>
          <a href="/reset-password" className="text-[#1c3e5e] hover:underline">
            Password dimenticata
          </a>
        </div>
      </div>
    </div>
  );
}
