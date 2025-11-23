// app/reset-password/page.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type Status = "idle" | "loading" | "success" | "error";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("loading");
    setError(null);

    try {
      const origin =
        typeof window !== "undefined"
          ? window.location.origin
          : process.env.NEXT_PUBLIC_SITE_URL || "";

      const { error } = await supabase.auth.resetPasswordForEmail(
        email.trim(),
        {
          redirectTo: `${origin}/update-password`,
        }
      );

      if (error) {
        setStatus("error");
        setError(error.message || "Errore durante l'invio della mail.");
        return;
      }

      setStatus("success");
    } catch (err: any) {
      setStatus("error");
      setError(err?.message || "Errore imprevisto.");
    }
  }

  const isLoading = status === "loading";

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
            Reimposta password
          </h1>
          <p className="mt-1 text-sm text-slate-500 text-center">
            Inserisci la tua email. Ti invieremo un link per impostare una nuova
            password.
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
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#1c3e5e] focus:ring-1 focus:ring-[#1c3e5e]"
              placeholder="info@spst.it"
            />
          </div>

          {error && (
            <p className="text-xs text-rose-600 bg-rose-50 border border-rose-100 rounded-md px-3 py-2">
              {error}
            </p>
          )}

          {status === "success" && (
            <p className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-md px-3 py-2">
              Se l’email esiste nei nostri sistemi, ti abbiamo inviato un link
              per reimpostare la password.
            </p>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full rounded-lg bg-[#1c3e5e] text-white text-sm font-medium py-2.5 mt-1 hover:opacity-95 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {isLoading ? "Invio in corso…" : "Invia link di reset"}
          </button>
        </form>

        <div className="mt-4 text-xs text-center">
          <button
            type="button"
            onClick={() => router.push("/login")}
            className="text-[#1c3e5e] hover:underline"
          >
            Torna al login
          </button>
        </div>
      </div>
    </div>
  );
}
