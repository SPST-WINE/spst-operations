// app/dashboard/quotazioni/page.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Package, Boxes } from 'lucide-react';

type QuoteParty = {
  ragioneSociale?: string | null;
  paese?: string | null;
  citta?: string | null;
};

type Quote = {
  id: string;
  status?: string | null;
  destinatario?: QuoteParty | null;
  formato_sped?: string | null;
  colli_n?: number | null;
  createdAt?: string | null;
};

function formatCityCountry(p?: QuoteParty | null): string {
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

function StatusBadge({ value }: { value?: string | null }) {
  const raw = (value || '').trim().toUpperCase();

  const map: Record<string, { cls: string; label: string }> = {
    'IN LAVORAZIONE': {
      cls: 'bg-slate-50 text-slate-700 ring-slate-200',
      label: 'IN LAVORAZIONE',
    },
    DISPONIBILE: {
      cls: 'bg-blue-50 text-blue-800 ring-blue-200',
      label: 'DISPONIBILE',
    },
    ACCETTATA: {
      cls: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
      label: 'ACCETTATA',
    },
  };

  let cls = 'bg-slate-50 text-slate-700 ring-slate-200';
  let text = raw || '—';

  if (map[raw]) {
    cls = map[raw].cls;
    text = map[raw].label;
  }

  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs ring-1 ${cls}`}
    >
      {text}
    </span>
  );
}

export default function QuotazioniPage() {
  const [items, setItems] = useState<Quote[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const res = await fetch('/api/quotazioni', {
          cache: 'no-store',
        });
        const data = await res.json().catch(() => ({}));

        if (cancelled) return;

        if (!res.ok || !data?.ok) {
          console.error('[quotazioni] API error:', data);
          setItems([]);
          return;
        }

        const normalized: Quote[] = (data.rows || []).map((r: any) => ({
          id: r.id,
          status: r.status || 'IN LAVORAZIONE',
          destinatario: r.destinatario || null,
          formato_sped: r.formato_sped || null,
          colli_n: r.colli_n || null,
          createdAt: r.fields?.['Creato il'] || r.fields?.created_at || null,
        }));

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
      const d = p.destinatario || {};
      const haystack = [
        p.id,
        d.ragioneSociale,
        d.citta,
        d.paese,
        p.status,
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
          Nessuna quotazione trovata. Crea la prima dalla voce "Nuova
          quotazione".
        </div>
      )}

      <div className="space-y-3">
        {filtered.map((p) => {
          const destinatario = formatCityCountry(p.destinatario);
          const destinatarioNome = p.destinatario?.ragioneSociale || '—';
          const created = formatDate(p.createdAt);
          const isPallet = /pallet/i.test(p.formato_sped || '');
          const formato = p.formato_sped || '—';
          const colli = p.colli_n ? `${p.colli_n} collo${p.colli_n > 1 ? 'i' : ''}` : '—';
          const isDisponibile = p.status === 'DISPONIBILE';
          const buttonText = isDisponibile ? 'Vedi quotazione ricevuta' : 'Dettagli';

          return (
            <div
              key={p.id}
              className="flex flex-col justify-between rounded-2xl border bg-white p-4 text-sm md:flex-row md:items-center"
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span
                    className={`inline-flex h-8 w-8 items-center justify-center rounded-lg ${
                      isPallet
                        ? 'bg-orange-50 text-spst-orange border border-orange-200'
                        : 'bg-slate-100 text-slate-700'
                    }`}
                  >
                    {isPallet ? (
                      <Boxes className="h-4 w-4" />
                    ) : (
                      <Package className="h-4 w-4" />
                    )}
                  </span>
                  <div>
                    <div className="font-semibold text-slate-800">
                      {destinatarioNome}
                    </div>
                    <div className="text-xs text-slate-500">
                      Destinazione: {destinatario}
                    </div>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
                  <span>
                    Formato: <span className="font-medium text-slate-700">{formato}</span>
                  </span>
                  <span>
                    Colli: <span className="font-medium text-slate-700">{colli}</span>
                  </span>
                  <span>
                    Creata il:{' '}
                    <span className="font-medium text-slate-700">{created}</span>
                  </span>
                </div>
              </div>

              <div className="mt-3 flex flex-col items-end gap-2 md:mt-0">
                <StatusBadge value={p.status} />
                <div className="text-[11px] uppercase tracking-wide text-slate-400">
                  ID: {p.id.slice(0, 8)}...
                </div>

                <Link
                  href={`/dashboard/quotazioni/${p.id}`}
                  className="rounded-lg border bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                >
                  {buttonText}
                </Link>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
