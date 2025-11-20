// app/dashboard/quotazioni/page.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { getPreventivi } from '@/lib/api';

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
  const cls = STATUS_COLORS[v] || 'bg-slate-100 text-slate-700 border-slate-200';
  return (
    <span
      className={`inline-block rounded-full border px-2 py-0.5 text-xs ${cls}`}
    >
      {v}
    </span>
  );
}

export default function QuotazioniListPage() {
  const [rows, setRows] = useState<any[]>([]);
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let abort = false;
    (async () => {
      setLoading(true);
      try {
        const r = await getPreventivi(); // niente più getIdToken
        if (!abort) setRows(r);
      } finally {
        if (!abort) setLoading(false);
      }
    })();
    return () => {
      abort = true;
    };
  }, []);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return rows;
    return rows.filter(r => {
      const f = r.fields || {};
      const txt = [
        f['Destinatario_Nome'],
        f['Destinatario_Citta'],
        f['Destinatario_Paese'],
        f['Mittente_Nome'],
        f['Slug_Pubblico'],
      ]
        .join(' ')
        .toLowerCase();
      const rid = (r.displayId || r.id || '').toString().toLowerCase();
      return txt.includes(needle) || rid.includes(needle);
    });
  }, [rows, q]);

  const PUBLIC_BASE =
    process.env.NEXT_PUBLIC_PUBLIC_QUOTE_BASE_URL ||
    'https://spst-logistics.vercel.app/quote';

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Le mie quotazioni</h2>

      <div className="flex items-center justify-between">
        <input
          className="w-full max-w-md rounded-lg border px-3 py-2 text-sm"
          placeholder="Cerca per destinatario, città, paese, ID…"
          value={q}
          onChange={e => setQ(e.target.value)}
        />
      </div>

      <div className="space-y-3">
        {loading && (
          <div className="text-sm text-slate-500">Caricamento…</div>
        )}
        {!loading && filtered.length === 0 && (
          <div className="text-sm text-slate-500">Nessun preventivo.</div>
        )}

        {!loading &&
          filtered.map(r => {
            const f = r.fields || {};
            const id = r.displayId || r.id;
            const hrefPubblico = `${PUBLIC_BASE}/${encodeURIComponent(id)}`;
            return (
              <div
                key={r.id}
                className="flex flex-col gap-2 rounded-2xl border bg-white p-4 text-sm md:flex-row md:items-center md:justify-between"
              >
                <div>
                  <div className="font-medium">
                    {f['Destinatario_Nome'] || '—'}
                  </div>
                  <div className="text-xs text-slate-500">
                    {(f['Destinatario_Citta'] || '—') +
                      ', ' +
                      (f['Destinatario_Paese'] || '—')}
                  </div>
                  <div className="mt-1 text-xs text-slate-500">
                    Mittente: {f['Mittente_Nome'] || '—'}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <StatusBadge value={f['Stato']} />
                  <div className="text-xs text-slate-500">
                    ID: <span className="font-mono">{id}</span>
                  </div>
                  <div className="flex gap-2">
                    <a
                      href={hrefPubblico}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-lg border bg-white px-3 py-1 text-xs hover:bg-slate-50"
                    >
                      Link pubblico
                    </a>
                    <Link
                      href="/dashboard/quotazioni/nuova"
                      className="rounded-lg border bg-white px-3 py-1 text-xs hover:bg-slate-50"
                    >
                      Duplica
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
