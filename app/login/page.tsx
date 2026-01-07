// app/login/page.tsx
"use client";

import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import { Eye, EyeOff } from "lucide-react";

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
  const [showPw, setShowPw] = useState(false);

  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);

  const isLoading = status === "loading";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("loading");
    setError(null);

    try {
      const r = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({ email: email.trim(), password }),
      });

      const j = await r.json().catch(() => ({}));

      if (!r.ok || !j?.ok) {
        setStatus("error");
        setError(j?.message || "Credenziali non valide.");
        return;
      }

      setStatus("success");
      router.push(nextPath);
      router.refresh();
    } catch (err: any) {
      setStatus("error");
      setError(err?.message || "Errore imprevisto durante il login.");
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-sm border border-slate-200 p-8">
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

            {/* wrapper per bottone show/hide */}
            <div className="relative">
              <input
                id="password"
                type={showPw ? "text" : "password"}
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 pr-11 text-sm outline-none focus:border-[#1c3e5e] focus:ring-1 focus:ring-[#1c3e5e]"
                placeholder="••••••••"
              />

              <button
                type="button"
                onClick={() => setShowPw((v) => !v)}
                aria-label={showPw ? "Nascondi password" : "Mostra password"}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-[#1c3e5e]/30"
              >
                {showPw ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>

          {error && (
            <p className="text-xs text-rose-700 bg-rose-50 border border-rose-100 rounded-md px-3 py-2">
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

        {/* bottoni link */}
        <div className="mt-5 grid grid-cols-2 gap-3">
          <a
            href="/reset-password"
            className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-[#1c3e5e]/30"
          >
            Hai dimenticato la password?
          </a>

          <a
            href="/signup"
            className="inline-flex items-center justify-center rounded-lg border border-[#1c3e5e]/20 bg-[#1c3e5e]/5 px-3 py-2 text-xs font-semibold text-[#1c3e5e] shadow-sm hover:bg-[#1c3e5e]/10 focus:outline-none focus:ring-2 focus:ring-[#1c3e5e]/30"
          >
            Registrati
          </a>
        </div>
      </div>
    </div>
  );
}
