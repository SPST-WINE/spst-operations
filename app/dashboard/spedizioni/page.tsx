"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@supabase/supabase-js";

type Row = {
  id: string;
  human_id: string | null;
  created_at: string;
  status: string | null;
  tipo_spedizione: string | null;
  incoterm: string | null;
  giorno_ritiro: string | null;
  note_ritiro: string | null;
  colli_n: number | null;
  peso_reale_kg: number | string | null;
  mittente_citta: string | null;
  dest_citta: string | null;
  carrier: string | null;
  tracking_code: string | null;
  email_norm: string | null;
};

type ApiList = {
  ok: boolean;
  page: number;
  limit: number;
  total: number;
  rows: Row[];
};

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL || (process.env as any).SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const supabase = createClient(SUPABASE_URL!, SUPABASE_ANON_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
});

export default function SpedizioniPage() {
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [limit] = useState(20);
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<Row[]>([]);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const pages = useMemo(() => Math.max(1, Math.ceil(total / limit)), [total, limit]);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token || null;

      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("limit", String(limit));
      if (q.trim()) params.set("q", q.trim());
      // params.set("debug", "1"); // abilita log verbosi lato API

      const r = await fetch(`/api/spedizioni?${params.toString()}`, {
        method: "GET",
        credentials: "include",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });

      const j: ApiList | any = await r.json().catch(() => ({}));
      if (!r.ok || !j?.ok) {
        throw new Error(j?.error || `${r.status} ${r.statusText}`);
      }
      setRows(j.rows || []);
      setTotal(j.total || 0);
    } catch (e: any) {
      console.error("[UI] GET /api/spedizioni error:", e);
      setError(e?.message || "Errore di caricamento");
      setRows([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, limit]);

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Le mie spedizioni</h2>

      <div className="flex gap-2 items-center">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Cerca per ID, città, tracking…"
          className="w-full rounded-lg border px-3 py-2 text-sm"
        />
        <button
          onClick={() => {
            setPage(1);
            load();
          }}
          className="rounded-lg border bg-white px-3 py-2 text-sm hover:bg-slate-50"
          disabled={loading}
        >
          Cerca
        </button>
      </div>

      {error && (
        <div className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="overflow-x-auto rounded-2xl border bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="px-3 py-2 text-left">ID</th>
              <th className="px-3 py-2 text-left">Creato</th>
              <th className="px-3 py-2 text-left">Tipo</th>
              <th className="px-3 py-2 text-left">Incoterm</th>
              <th className="px-3 py-2 text-left">Ritiro</th>
              <th className="px-3 py-2 text-left">Mittente</th>
              <th className="px-3 py-2 text-left">Destinatario</th>
              <th className="px-3 py-2 text-right">Colli</th>
              <th className="px-3 py-2 text-right">Peso (kg)</th>
              <th className="px-3 py-2 text-left">Stato</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={10} className="px-3 py-6 text-center text-slate-500">
                  Caricamento…
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={10} className="px-3 py-6 text-center text-slate-500">
                  Nessuna spedizione trovata.
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.id} className="border-t">
                  <td className="px-3 py-2 font-mono">{r.human_id || r.id}</td>
                  <td className="px-3 py-2">{new Date(r.created_at).toLocaleString()}</td>
                  <td className="px-3 py-2">{r.tipo_spedizione || "—"}</td>
                  <td className="px-3 py-2">{r.incoterm || "—"}</td>
                  <td className="px-3 py-2">
                    {r.giorno_ritiro ? new Date(r.giorno_ritiro).toLocaleDateString() : "—"}
                  </td>
                  <td className="px-3 py-2">{r.mittente_citta || "—"}</td>
                  <td className="px-3 py-2">{r.dest_citta || "—"}</td>
                  <td className="px-3 py-2 text-right">{r.colli_n ?? "—"}</td>
                  <td className="px-3 py-2 text-right">
                    {r.peso_reale_kg != null ? String(r.peso_reale_kg) : "—"}
                  </td>
                  <td className="px-3 py-2">{r.status || "—"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-end gap-2">
        <span className="text-sm text-slate-500">
          {rows.length} di {total} risultati — Pagina {page}/{pages}
        </span>
        <button
          className="rounded-lg border bg-white px-3 py-1 text-sm disabled:opacity-50"
          onClick={() => setPage((p) => Math.max(1, p - 1))}
          disabled={page <= 1 || loading}
        >
          ←
        </button>
        <button
          className="rounded-lg border bg-white px-3 py-1 text-sm disabled:opacity-50"
          onClick={() => setPage((p) => Math.min(pages, p + 1))}
          disabled={page >= pages || loading}
        >
          →
        </button>
      </div>
    </div>
  );
}
