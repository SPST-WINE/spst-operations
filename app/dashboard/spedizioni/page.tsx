'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

type ShipmentRow = {
  id: string;
  human_id: string | null;
  tipo_spedizione: string | null;
  incoterm: string | null;
  mittente_citta: string | null;
  dest_citta: string | null;
  giorno_ritiro: string | null;
  colli_n: number | null;
  peso_reale_kg: string | number | null;
  total_weight_real_kg?: string | number | null;
  total_weight_vol_kg?: string | number | null;
  total_weight_tariff_kg?: string | number | null;
  created_at: string;
};

type ApiResponse =
  | { ok: true; data: ShipmentRow[] }
  | { ok: false; error: string; details?: string };

function formatDate(value: string | null) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString('it-IT');
}

function formatNumber(value: string | number | null, decimals = 1) {
  if (value == null) return '—';
  const n = typeof value === 'string' ? Number(value) : value;
  if (Number.isNaN(n)) return String(value);
  return n.toLocaleString('it-IT', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

export default function ShipmentsPage() {
  const router = useRouter();
  const [data, setData] = useState<ShipmentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const res = await fetch('/api/my-shipments');
        const json = (await res.json()) as ApiResponse;
        if (cancelled) return;

        if (!res.ok || !json.ok) {
          setError('Errore nel caricamento delle spedizioni.');
          console.error('[Le mie spedizioni] API error:', json);
          return;
        }

        setData(json.data ?? []);
      } catch (e) {
        if (!cancelled) {
          setError('Errore di rete nel caricamento delle spedizioni.');
          console.error('[Le mie spedizioni] fetch error:', e);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">Le mie spedizioni</h2>
        <button
          type="button"
          onClick={() => router.push('/dashboard/nuova/vino')}
          className="rounded-lg border bg-white px-4 py-2 text-sm hover:bg-slate-50"
        >
          Nuova spedizione vino
        </button>
      </div>

      {loading && (
        <div className="rounded-2xl border bg-white p-4 text-sm text-slate-600 flex items-center gap-2">
          <span className="inline-block h-4 w-4 animate-spin rounded-full border border-slate-400 border-t-transparent" />
          Caricamento spedizioni…
        </div>
      )}

      {error && !loading && (
        <div className="rounded-2xl border border-red-300 bg-red-50 p-3 text-sm text-red-800">
          {error}
        </div>
      )}

      {!loading && !error && data.length === 0 && (
        <div className="rounded-2xl border bg-white p-4 text-sm text-slate-600">
          Nessuna spedizione ancora presente. Crea la tua prima spedizione dal pulsante in alto.
        </div>
      )}

      {!loading && !error && data.length > 0 && (
        <div className="overflow-x-auto rounded-2xl border bg-white">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-2 text-left">ID Spedizione</th>
                <th className="px-4 py-2 text-left">Tipo</th>
                <th className="px-4 py-2 text-left">Incoterm</th>
                <th className="px-4 py-2 text-left">Mittente</th>
                <th className="px-4 py-2 text-left">Destinatario</th>
                <th className="px-4 py-2 text-left">Giorno ritiro</th>
                <th className="px-4 py-2 text-right">Colli</th>
                <th className="px-4 py-2 text-right">Peso reale (kg)</th>
                <th className="px-4 py-2 text-left">Creata il</th>
              </tr>
            </thead>
            <tbody>
              {data.map((s) => (
                <tr
                  key={s.id}
                  className="border-t hover:bg-slate-50 cursor-pointer"
                  onClick={() => {
                    // in futuro potremo fare dettaglio: /dashboard/spedizioni/[id]
                    // Per ora non cambiamo pagina.
                  }}
                >
                  <td className="px-4 py-2 font-mono text-xs">
                    {s.human_id || s.id}
                  </td>
                  <td className="px-4 py-2">
                    {s.tipo_spedizione || '—'}
                  </td>
                  <td className="px-4 py-2">
                    {s.incoterm || '—'}
                  </td>
                  <td className="px-4 py-2">
                    {s.mittente_citta || '—'}
                  </td>
                  <td className="px-4 py-2">
                    {s.dest_citta || '—'}
                  </td>
                  <td className="px-4 py-2">
                    {formatDate(s.giorno_ritiro)}
                  </td>
                  <td className="px-4 py-2 text-right">
                    {s.colli_n ?? '—'}
                  </td>
                  <td className="px-4 py-2 text-right">
                    {formatNumber(s.peso_reale_kg, 1)}
                  </td>
                  <td className="px-4 py-2">
                    {formatDate(s.created_at)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
