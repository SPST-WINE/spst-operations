"use client";

import { FormEvent, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("next") || "/dashboard";

  const [email, setEmail] = useState("info@spst.it");
  const [password, setPassword] = useState("spst2025");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const { error: signError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signError) {
        // errore direttamente da Supabase (tipo "Invalid login credentials")
        setError(signError.message);
        setLoading(false);
        return;
      }

      router.push(redirectTo);
    } catch (err: any) {
      setError(err?.message || "Errore sconosciuto");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <form
        onSubmit={handleSubmit}
        className="w-[420px] rounded-xl bg-white shadow p-8 space-y-4 border border-slate-100"
      >
        <div className="flex flex-col items-center gap-2 mb-2">
          <div className="h-10 w-10 rounded-xl bg-amber-500 flex items-center justify-center text-white text-xl font-bold">
            S
          </div>
          <div className="text-lg font-semibold">Benvenuto in SPST</div>
          <div className="text-xs text-slate-500">
            Accedi con le tue credenziali
          </div>
        </div>

        <div className="space-y-2">
          <label className="block text-xs font-medium text-slate-700">
            Email
          </label>
          <input
            type="email"
            className="w-full rounded border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-amber-500/50"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
          />
        </div>

        <div className="space-y-2">
          <label className="block text-xs font-medium text-slate-700">
            Password
          </label>
          <input
            type="password"
            className="w-full rounded border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-amber-500/50"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
          />
        </div>

        {error && (
          <div className="text-xs text-red-600">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded bg-slate-900 text-white py-2 text-sm font-semibold hover:bg-slate-800 disabled:opacity-60"
        >
          {loading ? "Accesso in corso..." : "Entra"}
        </button>
      </form>
    </div>
  );
}
