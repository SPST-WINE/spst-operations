// app/dashboard/quotazioni/page.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { getPreventivi } from '@/lib/api';

type QuoteRow = {
  id: string;
  displayId?: string;
  status?: string;
  created_at?: string;
  fields?: Record<string, any>;
};

function formatDate(iso?: string) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('it-IT');
}

function getField(row: QuoteRow, key: string): string {
  const v = row.fields?.[key];
  return typeof v === 'string' && v.trim().length > 0 ? v : '—';
}

export default function QuotazioniPage() {
  const [rows, setRows] = useState<QuoteRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        // ⚠️ niente Firebase: non passiamo getIdToken
        const data = (await getPreventivi()) as any[];
        if (!cancelled) {
          setRows(Array.isArray(data) ? (data as QuoteRow[]) : []);
        }
        console.log('SPST[quotazioni] getPreventivi response:', data);
      } catch (e) {
        console.error('SPST[quotazioni] errore getPreventivi', e);
        if (!cancelled) {
          setError('Errore nel caricamento delle quotazioni.');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return rows;

    return rows.filter(row => {
      const f = row.fields || {};
      const parts = [
        row.displayId,
        row.id,
        row.status,
        f.destinatario_ragioneSociale,
        f.destinatario_citta,
        f.destinatario_paese,
        f.mittente_ragioneSociale,
      ]
        .filter(Boolean)
        .map((x: any) => String(x).toLowerCase());

      return parts.some(p => p.includes(term));
    });
  }, [rows, search]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold text-slate-800">Quotazioni</h1>
        <Link
          href="/dashboard/quotazioni/nuova"
          className="rounded-lg border bg-white px-4 py-2 text-sm hover:bg-slate-50"
        >
          Nuova quotazione
        </Link>
      </div>

      <div className="max-w-md">
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Cerca per destinatario, città, paese, ID…"
          className="w-full rounded-xl border px-3 py-2 text-sm"
        />
      </div>

      {error && (
        <div className="rounded-xl border border-rose-300 bg-rose-50 p-3 text-sm text-rose-800">
          {error}
        </div>
      )}

      {loading && (
        <div className="text-sm text-slate-500">Caricamento quotazioni…</div>
      )}

      {!loading && !filtered.length && (
        <div className="text-sm text-slate-500">
          Nessuna quotazione trovata.
        </div>
      )}

      <div className="space-y-3">
        {filtered.map(row => {
          const f = row.fields || {};
          const destNome =
            (f.destinatario_ragioneSociale as string) || '—';
          const destCitta = (f.destinatario_citta as string) || '—';
          const destPaese = (f.destinatario_paese as string) || '';
          const mittenteNome =
            (f.mittente_ragioneSociale as string) || '—';

          const status = row.status || (f.status as string) || 'In lavorazione';
          const displayId = row.displayId || (f.displayId as string) || row.id;

          return (
            <div
              key={row.id}
              className="flex flex-col gap-3 rounded-2xl border bg-white p-4 text-sm md:flex-row md:items-center md:justify-between"
            >
              <div>
                <div className="font-semibold">
                  {destNome}{' '}
                  {destPaese
                    ? `• ${destCitta || '—'}, ${destPaese}`
                    : destCitta
                    ? `• ${destCitta}`
                    : ''}
                </div>
                <div className="mt-1 text-xs text-slate-500">
                  Mittente: {mittenteNome}
                </div>
                <div className="mt-1 text-xs text-slate-400">
                  Creata il {formatDate(row.created_at)}
                </div>
              </div>

              <div className="flex flex-col items-start gap-2 md:items-end">
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
                    {status || 'In lavorazione'}
                  </span>
                </div>
                <div className="text-xs text-slate-400">
                  ID: <span className="font-mono">{displayId}</span>
                </div>
                <div className="flex gap-2">
                  <Link
                    href={`/dashboard/quotazioni/${encodeURIComponent(
                      row.id
                    )}`}
                    className="rounded-lg border bg-white px-3 py-1.5 text-xs hover:bg-slate-50"
                  >
                    Dettagli
                  </Link>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
