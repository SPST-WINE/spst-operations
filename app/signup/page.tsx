"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Eye, EyeOff } from "lucide-react";
import { supabaseBrowser } from "@/lib/supabase/browser";

type Status = "idle" | "loading" | "success" | "error";

export default function SignupPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);

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

      // Email confirmation ON
      if (!data.session) {
        setInfo(
          "Registrazione completata. Controlla la tua email per confermare l’account, poi effettua il login."
        );
        return;
      }

      // Email confirmation OFF
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

            <div className="relative">
              <input
                id="password"
                type={showPw ? "text" : "password"}
                autoComplete="new-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 pr-11 text-sm outline-none focus:border-[#1c3e5e] focus:ring-1 focus:ring-[#1c3e5e]"
                placeholder="Min. 8 caratteri"
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

          {/* Messaggi */}
          {error && (
            <p className="text-xs text-rose-700 bg-rose-50 border border-rose-100 rounded-md px-3 py-2">
              {error}
            </p>
          )}

          {info && (
            <p className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-md px-3 py-2">
              {info}
            </p>
          )}

          {/* Legal */}
          <p className="text-[11px] text-slate-500 leading-relaxed">
            Registrandoti accetti i{" "}
            <a
              href="https://www.spst.it/legal"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-[#1c3e5e] hover:underline"
            >
              Termini & Privacy
            </a>
            .
          </p>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full rounded-lg bg-[#1c3e5e] text-white text-sm font-medium py-2.5 mt-1 hover:opacity-95 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {isLoading ? "Creazione account…" : "Registrati"}
          </button>
        </form>

        {/* Bottoni link */}
        <div className="mt-5 grid grid-cols-2 gap-3">
          <a
            href="/login"
            className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-[#1c3e5e]/30"
          >
            Hai già un account?
          </a>

          <a
            href="/reset-password"
            className="inline-flex items-center justify-center rounded-lg border border-[#1c3e5e]/20 bg-[#1c3e5e]/5 px-3 py-2 text-xs font-semibold text-[#1c3e5e] shadow-sm hover:bg-[#1c3e5e]/10 focus:outline-none focus:ring-2 focus:ring-[#1c3e5e]/30"
          >
            Password dimenticata
          </a>
        </div>
      </div>
    </div>
  );
}
