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
  [key: string]: any;
};

function formatDate(iso?: string) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('it-IT');
}

/**
 * Helper: prende il primo valore stringa non vuoto fra:
 * 1) una lista di chiavi esplicite
 * 2) eventuali chiavi che "conten(g)ono" tutte le parole in containsAll
 */
function pickString(
  obj: Record<string, any>,
  explicitKeys: string[],
  containsAll: string[] = []
): string {
  for (const k of explicitKeys) {
    const v = obj[k];
    if (typeof v === 'string' && v.trim().length > 0) return v.trim();
  }

  if (containsAll.length) {
    for (const k of Object.keys(obj)) {
      const lk = k.toLowerCase();
      if (containsAll.every(c => lk.includes(c.toLowerCase()))) {
        const v = obj[k];
        if (typeof v === 'string' && v.trim().length > 0) return v.trim();
      }
    }
  }

  return '—';
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
        const data = (await getPreventivi()) as any;

        console.log('SPST[quotazioni] getPreventivi raw response:', data);

        if (cancelled) return;

        // l’API potrebbe restituire { ok, data }, oppure direttamente un array
        const arr: QuoteRow[] = Array.isArray(data)
          ? data
          : Array.isArray(data?.data)
          ? data.data
          : [];

        setRows(arr);
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
      const flat = { ...(row.fields || {}), ...row };

      const pieces: string[] = [
        flat.displayId,
        flat.id,
        flat.status,
        flat.destinatario_ragioneSociale,
        flat.destinatario_ragione_sociale,
        flat.destinatario_nome,
        flat.mittente_ragioneSociale,
        flat.mittente_ragione_sociale,
        flat.mittente_nome,
        flat.destinatario_citta,
        flat.destinatario_city,
        flat.destinatario_paese,
        flat.destinatario_country,
      ]
        .filter(Boolean)
        .map((x: any) => String(x).toLowerCase());

      return pieces.some(p => p.includes(term));
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

      {!loading && !filtered.length && !error && (
        <div className="text-sm text-slate-500">
          Nessuna quotazione trovata.
        </div>
      )}

      <div className="space-y-3">
        {filtered.map(row => {
          const flat: Record<string, any> = { ...(row.fields || {}), ...row };

          // Destinatario
          const destNome = pickString(
            flat,
            [
              'destinatario_ragioneSociale',
              'destinatario_ragione_sociale',
              'destinatario_nome',
              'destinatario_name',
              'to_name',
            ],
            ['destinatario', 'ragione']
          );

          const destCitta = pickString(
            flat,
            ['destinatario_citta', 'destinatario_city'],
            ['destinatario', 'citt']
          );

          const destPaese = pickString(
            flat,
            ['destinatario_paese', 'destinatario_country'],
            ['destinatario', 'paese']
          );

          // Mittente
          const mittenteNome = pickString(
            flat,
            [
              'mittente_ragioneSociale',
              'mittente_ragione_sociale',
              'mittente_nome',
              'mittente_name',
              'from_name',
            ],
            ['mittente', 'ragione']
          );

          // Status
          const statusVal =
            flat.status ||
            flat.stato ||
            pickString(flat, ['status', 'stato'], ['status']) ||
            'In lavorazione';

          // ID visualizzato
          const displayId =
            flat.displayId ||
            flat['ID preventivo'] ||
            flat.id?.toString() ||
            '';

          return (
            <div
              key={flat.id || displayId}
              className="flex flex-col gap-3 rounded-2xl border bg-white p-4 text-sm md:flex-row md:items-center md:justify-between"
            >
              <div>
                <div className="font-semibold">
                  {destNome}{' '}
                  {destPaese !== '—'
                    ? `• ${destCitta !== '—' ? destCitta : '—'}, ${destPaese}`
                    : destCitta !== '—'
                    ? `• ${destCitta}`
                    : ''}
                </div>
                <div className="mt-1 text-xs text-slate-500">
                  Mittente:{' '}
                  <span className="font-medium text-slate-700">
                    {mittenteNome}
                  </span>
                </div>
                <div className="mt-1 text-xs text-slate-400">
                  Creata il {formatDate(flat.created_at)}
                </div>
              </div>

              <div className="flex flex-col items-start gap-2 md:items-end">
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
                    {statusVal}
                  </span>
                </div>
                <div className="text-xs text-slate-400">
                  ID:{' '}
                  <span className="font-mono">
                    {displayId || flat.id || '—'}
                  </span>
                </div>
                <div className="flex gap-2">
                  <Link
                    href={`/dashboard/quotazioni/${encodeURIComponent(
                      flat.id || displayId || ''
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
