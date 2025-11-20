// app/dashboard/quotazioni/[id]/page.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import { getPreventivo } from '@/lib/api';
import Link from 'next/link';

// alias tolleranti per leggere i campi dei colli
const QTY_KEYS = ['Quantita', 'Quantità', 'Qty', 'Q.ta', 'quantita'];
const L_KEYS = ['L_cm', 'Lato 1', 'Lato1', 'Lunghezza', 'L', 'lunghezza_cm'];
const W_KEYS = ['W_cm', 'Lato 2', 'Lato2', 'Larghezza', 'W', 'larghezza_cm'];
const H_KEYS = ['H_cm', 'Lato 3', 'Lato3', 'Altezza', 'H', 'altezza_cm'];

function pickNumber(f: any, keys: string[]) {
  for (const k of keys) {
    const v = f?.[k];
    const n =
      typeof v === 'number'
        ? v
        : v != null && v !== ''
        ? Number(String(v).replace(',', '.'))
        : NaN;
    if (!Number.isNaN(n)) return n;
  }
  return undefined;
}

function fmtDate(d?: string) {
  if (!d) return '—';
  try {
    const dt = new Date(d);
    return dt.toLocaleDateString('it-IT');
  } catch {
    return '—';
  }
}

export default function QuoteDetailPage({ params }: { params: { id: string } }) {
  const [row, setRow] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const id = decodeURIComponent(params.id);

  useEffect(() => {
    let abort = false;
    (async () => {
      setLoading(true);
      try {
        // nuova API Supabase: /api/quotazioni/[id] -> { ok:true, row }
        const r = await getPreventivo(id); // niente Firebase
        if (!abort) setRow(r);
      } finally {
        if (!abort) setLoading(false);
      }
    })();
    return () => {
      abort = true;
    };
  }, [id]);

  const f = row?.fields || {};
  const stato = f['Stato'] || f['Status'] || '—';
  const incoterm = f['Incoterm'] || f['Incoterms'] || '—';
  const tipoSped =
    f['Tipo_Spedizione'] ||
    f['Tipo spedizione'] ||
    f['Tipo Spedizione'] ||
    f['Tipologia'] ||
    f['Tipo'] ||
    f['TipoSped'] ||
    f['tipoSped'] ||
    '—';

  const ritiro =
    f['Ritiro_Data'] ||
    f['Data_Ritiro'] ||
    f['RitiroData'] ||
    f['ritiroData'] || // nuovo campo nel payload Supabase
    f['PickUp_Date'] ||
    f['Data ritiro'] ||
    f['Data Ritiro'] ||
    f[' Data Ritiro '] ||
    f[' Data ritiro '];

  const mitt = {
    nome:
      f['Mittente_Nome'] ||
      f['Mittente'] ||
      f['Ragione sociale Mittente'] ||
      f['Mittente RS'],
    ind:
      f['Mittente_Indirizzo'] ||
      f['Indirizzo Mittente'] ||
      f['Mittente Indirizzo'],
    cap: f['Mittente_CAP'] || f['CAP Mittente'],
    citta: f['Mittente_Citta'] || f['Città Mittente'] || f['Mittente Citta'],
    paese: f['Mittente_Paese'] || f['Paese Mittente'],
  };
  const dest = {
    nome:
      f['Destinatario_Nome'] ||
      f['Destinatario'] ||
      f['Ragione sociale Destinatario'] ||
      f['Destinatario RS'],
    ind:
      f['Destinatario_Indirizzo'] ||
      f['Indirizzo Destinatario'] ||
      f['Destinatario Indirizzo'],
    cap: f['Destinatario_CAP'] || f['CAP Destinatario'],
    citta:
      f['Destinatario_Citta'] ||
      f['Città Destinatario'] ||
      f['Destinatario Citta'],
    paese: f['Destinatario_Paese'] || f['Paese Destinatario'],
  };

  const colli = useMemo(() => {
    // con Supabase la API mette già un array "piatto" in row.colli
    const arr: any[] = Array.isArray(row?.colli) ? row!.colli : [];
    return arr.map((c, i) => {
      const cf = c || {};
      const qty = pickNumber(cf, QTY_KEYS) ?? 1;
      const L = pickNumber(cf, L_KEYS);
      const W = pickNumber(cf, W_KEYS);
      const H = pickNumber(cf, H_KEYS);
      const peso =
        pickNumber(cf, ['Peso', 'Peso (Kg)', 'Peso_Kg', 'Kg', 'Weight', 'peso_kg']) ??
        undefined;

      const dimsParts = [L, W, H].map((n) => (n != null ? String(n) : '—'));
      const dims =
        L == null && W == null && H == null
          ? '—'
          : `${dimsParts[0]} × ${dimsParts[1]} × ${dimsParts[2]}`;

      return { i: i + 1, qty, dims, peso: peso ?? '—' };
    });
  }, [row]);

  if (loading) {
    return <div className="p-6 text-sm text-slate-600">Caricamento…</div>;
  }
  if (!row) {
    return (
      <div className="p-6">
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">
          Preventivo non trovato.
        </div>
        <div className="mt-4">
          <Link
            href="/dashboard/quotazioni"
            className="rounded-lg border px-3 py-1.5 text-sm hover:bg-slate-50"
          >
            Torna alla lista
          </Link>
        </div>
      </div>
    );
  }

  const displayId = row.displayId || row.id;

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold">Dettaglio preventivo</h2>

      <div className="rounded-xl border bg-white p-4 shadow-sm">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <div className="text-xs uppercase text-slate-500">ID preventivo</div>
            <div className="font-medium">{displayId}</div>
          </div>
          <div>
            <div className="text-xs uppercase text-slate-500">Stato</div>
            <div className="font-medium">{stato || '—'}</div>
          </div>
          <div>
            <div className="text-xs uppercase text-slate-500">Tipo spedizione</div>
            <div className="font-medium">{tipoSped}</div>
          </div>
          <div>
            <div className="text-xs uppercase text-slate-500">Incoterm</div>
            <div className="font-medium">{incoterm}</div>
          </div>
          <div>
            <div className="text-xs uppercase text-slate-500">Data ritiro</div>
            <div className="font-medium">{fmtDate(ritiro)}</div>
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border bg-white p-4 shadow-sm">
          <div className="text-sm font-semibold">Mittente</div>
          <div className="mt-1 text-sm text-slate-700">
            <div className="font-medium">{mitt.nome || '—'}</div>
            <div className="text-slate-500">
              {[mitt.ind, [mitt.citta, mitt.cap].filter(Boolean).join(' '), mitt.paese]
                .filter(Boolean)
                .join(', ') || '—'}
            </div>
          </div>
        </div>

        <div className="rounded-xl border bg-white p-4 shadow-sm">
          <div className="text-sm font-semibold">Destinatario</div>
          <div className="mt-1 text-sm text-slate-700">
            <div className="font-medium">{dest.nome || '—'}</div>
            <div className="text-slate-500">
              {[dest.ind, [dest.citta, dest.cap].filter(Boolean).join(' '), dest.paese]
                .filter(Boolean)
                .join(', ') || '—'}
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-xl border bg-white p-4 shadow-sm">
        <div className="text-sm font-semibold">Colli</div>

        {colli.length === 0 ? (
          <div className="mt-2 text-sm text-slate-500">Nessun collo indicato.</div>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="min-w-[560px] w-full text-sm">
              <thead className="text-left text-slate-500">
                <tr>
                  <th className="pb-2 pr-4">#</th>
                  <th className="pb-2 pr-4">Quantità</th>
                  <th className="pb-2 pr-4">Dimensioni (cm)</th>
                  <th className="pb-2 pr-2">Peso (kg)</th>
                </tr>
              </thead>
              <tbody className="align-top">
                {colli.map((c) => (
                  <tr key={c.i} className="border-t">
                    <td className="py-2 pr-4">{c.i}</td>
                    <td className="py-2 pr-4">{c.qty}</td>
                    <td className="py-2 pr-4">{c.dims}</td>
                    <td className="py-2 pr-2">{c.peso ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div>
        <Link
          href="/dashboard/quotazioni"
          className="rounded-lg border px-3 py-1.5 text-sm hover:bg-slate-50"
        >
          Torna alla lista
        </Link>
      </div>
    </div>
  );
}
