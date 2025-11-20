// app/dashboard/quotazioni/page.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { getPreventivi } from '@/lib/api'; // <-- usa il client generico, niente Firebase

type MittenteDestinatario = {
  ragioneSociale?: string | null;
  paese?: string | null;
  citta?: string | null;
};

type RawRecord = {
  id: string;
  fields?: any;
};

type Preventivo = {
  id: string;
  displayId?: string | null;
  status?: string | null;
  mittente?: MittenteDestinatario | null;
  destinatario?: MittenteDestinatario | null;
  createdAt?: string | null;
};

function formatCityCountry(p?: MittenteDestinatario | null): string {
  if (!p) return '—';
  const city = (p.citta || '').trim();
  const country = (p.paese || '').trim();

  if (city && country) return `${city}, ${country}`;
  if (city) return city;
  if (country) return country;
  return '—';
}

function formatDate(iso?: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('it-IT');
}

export default function QuotazioniPage() {
  const [items, setItems] = useState<Preventivo[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        // Chiede alla API /api/quotazioni e si aspetta { ok, rows }
        const rows = (await getPreventivi()) as RawRecord[];

        console.log('SPST[quotazioni] getPreventivi raw response:', rows);

        if (cancelled) return;

        const normalized: Preventivo[] = rows.map((r) => {
          const f = r.fields || {};
          const mittente: MittenteDestinatario | null =
            f.mittente ?? f.mittente_json ?? null;
          const destinatario: MittenteDestinatario | null =
            f.destinatario ?? f.destinatario_json ?? null;

          return {
            id: r.id,
            displayId:
              f.Slug_Pubblico ??
              f.display_id ??
              f.displayId ??
              r.id,
            status: f.Stato ?? f.status ?? 'In lavorazione',
            mittente,
            destinatario,
            createdAt:
              f['Creato il'] ??
              f.created_at ??
              f.createdAt ??
              null,
          };
        });

        setItems(normalized);
      } catch (e) {
        console.error('SPST[quotazioni] errore getPreventivi', e);
        setItems([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;

    return items.filter((p) => {
      const m = p.mittente || {};
      const d = p.destinatario || {};
      const haystack = [
        p.displayId,
        p.id,
        m.ragioneSociale,
        m.citta,
        m.paese,
        d.ragioneSociale,
        d.citta,
        d.paese,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return haystack.includes(q);
    });
  }, [items, search]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-slate-800">Quotazioni</h1>
        <Link
          href="/dashboard/quotazioni/nuova"
          className="rounded-lg border bg-white px-4 py-2 text-sm hover:bg-slate-50"
        >
          Nuova quotazione
        </Link>
      </div>

      <div>
        <input
          type="text"
          className="w-full max-w-md rounded-lg border px-3 py-2 text-sm"
          placeholder="Cerca per destinatario, città, paese, ID..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {loading && (
        <div className="text-sm text-slate-500">Caricamento quotazioni…</div>
      )}

      {!loading && filtered.length === 0 && (
        <div className="text-sm text-slate-500">
          Nessuna quotazione trovata. Crea la prima dalla voce “Nuova
          quotazione”.
        </div>
      )}

      <div className="space-y-3">
        {filtered.map((p) => {
          const title = formatCityCountry(p.destinatario || p.mittente || null);
          const mittenteNome = p.mittente?.ragioneSociale || '—';
          const created = formatDate(p.createdAt);

          return (
            <div
              key={p.id}
              className="flex flex-col justify-between rounded-2xl border bg-white p-4 text-sm md:flex-row md:items-center"
            >
              <div className="space-y-1">
                <div className="font-semibold text-slate-800">
                  {title}
                </div>
                <div className="text-xs text-slate-500">
                  Mittente:{' '}
                  <span className="font-medium text-slate-700">
                    {mittenteNome}
                  </span>
                </div>
                <div className="text-xs text-slate-500">
                  Creata il:{' '}
                  <span className="font-medium text-slate-700">
                    {created}
                  </span>
                </div>
              </div>

              <div className="mt-3 flex flex-col items-end gap-2 md:mt-0">
                <div className="text-[11px] uppercase tracking-wide text-slate-400">
                  ID: {p.displayId || p.id}
                </div>

                <Link
                  href={`/dashboard/quotazioni/${p.id}`}
                  className="rounded-lg border bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
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
