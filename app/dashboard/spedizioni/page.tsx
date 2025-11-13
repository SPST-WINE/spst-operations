// app/dashboard/spedizioni/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";

type Row = {
  id: string;
  human_id?: string | null;
  created_at?: string;
  status?: string | null;
  tipo_spedizione?: string | null;
  incoterm?: string | null;
  giorno_ritiro?: string | null;
  note_ritiro?: string | null;
  colli_n?: number | null;
  peso_reale_kg?: string | number | null;
  mittente_citta?: string | null;
  dest_citta?: string | null;
  carrier?: string | null;
  tracking_code?: string | null;
  email_norm?: string | null;
};

export default function SpedizioniPage() {
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [limit] = useState(20);
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<Row[]>([]);
  const [total, setTotal] = useState(0);

  const order = "created_at.desc";
  const pageCount = useMemo(() => Math.max(1, Math.ceil(total / limit)), [total, limit]);

  const fetchRows = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(limit),
        order,
      });
      if (q.trim()) params.set("q", q.trim());

      const r = await fetch(`/api/spedizioni?${params.toString()}`, { cache: "no-store" });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j?.ok) {
        console.error("Fetch spedizioni error:", j?.error || r.statusText);
        setRows([]);
        setTotal(0);
      } else {
        setRows(j.rows || []);
        setTotal(j.total || 0);
      }
    } catch (e) {
      console.error("Fetch spedizioni exception:", e);
      setRows([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRows();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, limit, order]);

  const onSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchRows();
  };

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Le mie spedizioni</h2>

      <form onSubmit={onSearch} className="flex gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Cerca per ID, città, tracking..."
          className="border rounded-lg px-3 py-2 text-sm w-full"
        />
        <button
          type="submit"
          className="rounded-lg border bg-white px-4 py-2 text-sm hover:bg-slate-50"
          disabled={loading}
        >
          Cerca
        </button>
      </form>

      <div className="rounded-2xl border bg-white overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="text-left p-3">ID</th>
              <th className="text-left p-3">Creato</th>
              <th className="text-left p-3">Tipo</th>
              <th className="text-left p-3">Incoterm</th>
              <th className="text-left p-3">Ritiro</th>
              <th className="text-left p-3">Mittente</th>
              <th className="text-left p-3">Destinatario</th>
              <th className="text-left p-3">Colli</th>
              <th className="text-left p-3">Peso (kg)</th>
              <th className="text-left p-3">Stato</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td className="p-3" colSpan={10}>
                  Caricamento…
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td className="p-3" colSpan={10}>
                  Nessuna spedizione trovata.
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.id} className="border-t">
                  <td className="p-3 font-mono">{r.human_id || r.id}</td>
                  <td className="p-3">{r.created_at ? new Date(r.created_at).toLocaleString() : "—"}</td>
                  <td className="p-3">{r.tipo_spedizione || "—"}</td>
                  <td className="p-3">{r.incoterm || "—"}</td>
                  <td className="p-3">{r.giorno_ritiro || "—"}</td>
                  <td className="p-3">{r.mittente_citta || "—"}</td>
                  <td className="p-3">{r.dest_citta || "—"}</td>
                  <td className="p-3">{r.colli_n ?? "—"}</td>
                  <td className="p-3">{r.peso_reale_kg ?? "—"}</td>
                  <td className="p-3">{r.status || "—"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between">
        <span className="text-xs text-slate-500">
          {total} risultati · Pagina {page}/{pageCount}
        </span>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={loading || page <= 1}
            className="rounded-lg border bg-white px-3 py-1 text-sm disabled:opacity-50"
          >
            ←
          </button>
          <button
            type="button"
            onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
            disabled={loading || page >= pageCount}
            className="rounded-lg border bg-white px-3 py-1 text-sm disabled:opacity-50"
          >
            →
          </button>
        </div>
      </div>
    </div>
  );
}
