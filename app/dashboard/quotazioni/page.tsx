// app/dashboard/quotazioni/page.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { getPreventivi } from '@/lib/api';
import { getIdToken } from '@/lib/firebase-client-auth';

const STATUS_COLORS: Record<string, string> = {
  Accettato: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  Convertito: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  Pubblicato: 'bg-blue-100 text-blue-700 border-blue-200',
  'Bozza (cliente)': 'bg-amber-100 text-amber-700 border-amber-200',
  Scaduto: 'bg-slate-200 text-slate-600 border-slate-300',
  'In lavorazione': 'bg-amber-100 text-amber-700 border-amber-200',
};

function StatusBadge({ value }: { value?: string }) {
  const v = value || 'In lavorazione';
  const cls =
    STATUS_COLORS[v] || 'bg-slate-100 text-slate-700 border-slate-200';
  return (
    <span
      className={`inline-block rounded-full border px-2 py-0.5 text-xs ${cls}`}
    >
      {v}
    </span>
  );
}

type PreventivoRow = {
  id: string;
  displayId?: string;
  fields?: Record<string, any>;
  [key: string]: any;
};

export default function QuotazioniListPage() {
  const [rows, setRows] = useState<PreventivoRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        setLoading(true);
        setError(null);

        const data = await getPreventivi(getIdToken);

        if (!cancelled) {
          setRows(Array.isArray(data) ? (data as PreventivoRow[]) : []);
        }
      } catch (e: any) {
        console.error('SPST[quotazioni] errore getPreventivi', e);
        if (!cancelled) {
          setError('Errore nel recupero delle quotazioni.');
          setRows([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return rows;

    return rows.filter((r) => {
      const f = (r as any).fields || (r as any) || {};
      const displayId = (
        r.displayId ||
        (f['ID preventivo'] as string) ||
        r.id
      )
        ?.toString()
        .toLowerCase();

      const dest =
        (f['Destinatario_Nome'] as string) ||
        (f['Destinatario'] as string) ||
        (f['Ragione sociale Destinatario'] as string) ||
        '';
      const mitt =
        (f['Mittente_Nome'] as string) ||
        (f['Mittente'] as string) ||
        (f['Ragione sociale Mittente'] as string) ||
        '';
      const city =
        (f['Destinatario_Citta'] as string) ||
        (f['Destinatario Citta'] as string) ||
        (f['Città Destinatario'] as string) ||
        '';
      const country =
        (f['Destinatario_Paese'] as string) ||
        (f['Destinatario Paese'] as string) ||
        '';
      const loc = `${city} ${country}`.toLowerCase();

      const haystack = [
        displayId,
        dest.toLowerCase(),
        mitt.toLowerCase(),
        loc,
      ];

      return haystack.some(
        (v) => v && v.length > 0 && v.includes(term)
      );
    });
  }, [rows, query]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-slate-800">Quotazioni</h1>
        <Link
          href="/dashboard/quotazioni/nuova"
          className="rounded-lg border bg-white px-4 py-2 text-sm hover:bg-slate-50"
        >
          Nuova quotazione
        </Link>
      </div>

      {/* Search */}
      <div>
        <input
          type="text"
          placeholder="Cerca per destinatario, città, paese, ID…"
          className="w-full rounded-xl border px-3 py-2 text-sm"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      {/* Stato caricamento / errore */}
      {loading && (
        <div className="text-sm text-slate-500">Caricamento in corso…</div>
      )}
      {error && !loading && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
          {error}
        </div>
      )}
      {!loading && !error && filtered.length === 0 && (
        <div className="text-sm text-slate-500">
          Nessuna quotazione trovata.
        </div>
      )}

      {/* Lista card */}
      <div className="space-y-3">
        {filtered.map((row) => {
          const f = (row as any).fields || (row as any) || {};

          const id = (row.id || f.id || f.ID)?.toString();
          const displayId =
            (row.displayId as string) ||
            (f['ID preventivo'] as string) ||
            id ||
            '';

          const stato =
            (row as any).stato ||
            (row as any).status ||
            (f['Stato'] as string) ||
            (f['Status'] as string) ||
            'In lavorazione';

          const dest =
            (f['Destinatario_Nome'] as string) ||
            (f['Destinatario'] as string) ||
            (f['Ragione sociale Destinatario'] as string) ||
            '—';

          const city =
            (f['Destinatario_Citta'] as string) ||
            (f['Destinatario Citta'] as string) ||
            (f['Città Destinatario'] as string) ||
            '';
          const country =
            (f['Destinatario_Paese'] as string) ||
            (f['Destinatario Paese'] as string) ||
            '';
          const loc = [city, country].filter(Boolean).join(', ');

          const mitt =
            (f['Mittente_Nome'] as string) ||
            (f['Mittente'] as string) ||
            (f['Ragione sociale Mittente'] as string) ||
            '';

          return (
            <div
              key={id || displayId}
              className="rounded-2xl border bg-white p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-medium">{dest}</div>
                  <div className="text-xs text-slate-500">
                    {loc || '—'}
                  </div>
                  {mitt && (
                    <div className="mt-1 text-xs text-slate-500">
                      Mittente:{' '}
                      <span className="font-medium text-slate-700">
                        {mitt}
                      </span>
                    </div>
                  )}
                </div>

                <div className="flex flex-col items-end gap-1 text-right">
                  <div className="text-xs uppercase text-slate-500">
                    ID preventivo
                  </div>
                  <div className="text-sm font-medium">
                    {displayId || '—'}
                  </div>
                  <StatusBadge value={stato} />
                </div>
              </div>

              <div className="mt-3 flex justify-end">
                <Link
                  href={`/dashboard/quotazioni/${encodeURIComponent(
                    displayId || id || ''
                  )}`}
                  className="rounded-lg border px-3 py-1.5 text-sm hover:bg-slate-50"
                >
                  Dettagli
                </Link>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
