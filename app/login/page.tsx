// app/login/page.tsx
"use client";

import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import { supabaseBrowser } from "@/lib/supabase/browser";

type Status = "idle" | "loading" | "success" | "error";

function norm(s?: string | null) {
  return (s || "").trim();
}

export default function LoginPage() {
  const router = useRouter();
  const sp = useSearchParams();

  const nextPath = useMemo(() => {
    const n = norm(sp.get("next"));
    return n || "/dashboard/spedizioni";
  }, [sp]);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);

  const isLoading = status === "loading";

  async function checkEnabledIfPresent(userId: string): Promise<boolean> {
    // Se tabella/colonna non esistono o policy non consente, NON blocchiamo.
    try {
      const supabase = supabaseBrowser();

      const { data, error } = await supabase
        .from("profiles")
        .select("enabled")
        .eq("id", userId)
        .maybeSingle();

      // Se errore "relation does not exist" / "column does not exist" / RLS etc → passa
      if (error) return true;

      // Se record manca → passa
      if (!data) return true;

      // Se enabled è null/undefined → passa
      if (typeof (data as any).enabled !== "boolean") return true;

      return (data as any).enabled === true;
    } catch {
      return true;
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("loading");
    setError(null);

    try {
      const supabase = supabaseBrowser();

      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) {
        setStatus("error");
        setError(error.message || "Credenziali non valide.");
        return;
      }

      const userId = data.user?.id;
      if (!userId) {
        setStatus("error");
        setError("Sessione non valida. Riprova.");
        return;
      }

      const okEnabled = await checkEnabledIfPresent(userId);
      if (!okEnabled) {
        await supabase.auth.signOut();
        setStatus("error");
        setError("Account non abilitato. Contatta il supporto SPST.");
        return;
      }

      setStatus("success");
      router.push(nextPath);
    } catch (err: any) {
      setStatus("error");
      setError(err?.message || "Errore imprevisto durante il login.");
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
            Benvenuto in SPST
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Accedi con le tue credenziali
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
              placeholder="info@spst.it"
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
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#1c3e5e] focus:ring-1 focus:ring-[#1c3e5e]"
              placeholder="••••••••"
            />
          </div>

          {error && (
            <p className="text-xs text-rose-600 bg-rose-50 border border-rose-100 rounded-md px-3 py-2">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full rounded-lg bg-[#1c3e5e] text-white text-sm font-medium py-2.5 mt-2 hover:opacity-95 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {isLoading ? "Accesso in corso…" : "Entra"}
          </button>
        </form>

        <div className="mt-4 flex items-center justify-between text-xs">
          <a href="/reset-password" className="text-[#1c3e5e] hover:underline">
            Hai dimenticato la password?
          </a>

          {/* info sul redirect (utile in debug, discreto) */}
          <span className="text-slate-400">
            → {nextPath.replace(/^\/dashboard/, "/dashboard")}
          </span>
        </div>
      </div>
    </div>
  );
}
