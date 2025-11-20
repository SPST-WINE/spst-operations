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

type QuoteParty = {
  ragioneSociale?: string;
  indirizzo?: string;
  cap?: string;
  citta?: string;
  paese?: string;
  telefono?: string;
  taxId?: string;
  referente?: string;
};

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
        const r = await getPreventivo(id);
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

  // ---- meta / header ------------------------------------------------
  const stato = f['Stato'] || f['Status'] || '—';
  const incoterm =
    f['Incoterm'] || f['Incoterms'] || f['Incoterm_Selezionato'] || '—';
  const tipoSped =
    f['tipoSped'] ||
    f['Tipo_Spedizione'] ||
    f['Tipo spedizione'] ||
    f['Tipo Spedizione'] ||
    f['Tipologia'] ||
    f['Tipo'] ||
    f['TipoSped'] ||
    '—';

  const ritiro =
    f['ritiroData'] ||
    f['Ritiro_Data'] ||
    f['Data_Ritiro'] ||
    f['RitiroData'] ||
    f['PickUp_Date'] ||
    f['Data ritiro'] ||
    f['Data Ritiro'];

  const valuta = f['valuta'] || f['Valuta'] || 'EUR';
  const emailCliente =
    f['customerEmail'] ||
    f['EmailCliente'] ||
    f['Email_Cliente'] ||
    f['Email Cliente'] ||
    f['Cliente_Email'] ||
    f['Customer_Email'] ||
    '—';
  const creatoDaEmail =
    f['createdByEmail'] ||
    f['CreatoDaEmail'] ||
    f['Creato da (email)'] ||
    f['Created By Email'] ||
    f['Creato da Email'] ||
    '—';

  const noteGeneriche =
    f['noteGeneriche'] ||
    f['Note generiche sulla spedizione'] ||
    f['Note_Spedizione'] ||
    f['Shipment_Notes'] ||
    f['Note spedizione'] ||
    '';

  // ---- mittente / destinatario -------------------------------------
  const mittParty: QuoteParty = (f.mittente || {}) as QuoteParty;
  const destParty: QuoteParty = (f.destinatario || {}) as QuoteParty;

  const mitt = {
    nome:
      mittParty.ragioneSociale ||
      f['Mittente_Nome'] ||
      f['Mittente'] ||
      f['Ragione sociale Mittente'] ||
      f['Mittente RS'],
    referente:
      mittParty.referente ||
      f['Mittente_Referente'] ||
      f['Mittente - Referente'],
    ind:
      mittParty.indirizzo ||
      f['Mittente_Indirizzo'] ||
      f['Indirizzo Mittente'] ||
      f['Mittente Indirizzo'],
    cap: mittParty.cap || f['Mittente_CAP'] || f['CAP Mittente'],
    citta:
      mittParty.citta ||
      f['Mittente_Citta'] ||
      f['Città Mittente'] ||
      f['Mittente Citta'],
    paese: mittParty.paese || f['Mittente_Paese'] || f['Paese Mittente'],
    telefono:
      mittParty.telefono ||
      f['Mittente_Telefono'] ||
      f['Telefono Mittente'],
    taxId:
      mittParty.taxId ||
      f['Mittente_Tax'] ||
      f['Mittente_PIVA'] ||
      f['Mittente_EORI'] ||
      f['P.IVA Mittente'] ||
      f['PIVA Mittente'],
  };

  const dest = {
    nome:
      destParty.ragioneSociale ||
      f['Destinatario_Nome'] ||
      f['Destinatario'] ||
      f['Ragione sociale Destinatario'] ||
      f['Destinatario RS'],
    referente:
      destParty.referente ||
      f['Destinatario_Referente'] ||
      f['Destinatario - Referente'],
    ind:
      destParty.indirizzo ||
      f['Destinatario_Indirizzo'] ||
      f['Indirizzo Destinatario'] ||
      f['Destinatario Indirizzo'],
    cap: destParty.cap || f['Destinatario_CAP'] || f['CAP Destinatario'],
    citta:
      destParty.citta ||
      f['Destinatario_Citta'] ||
      f['Città Destinatario'] ||
      f['Destinatario Citta'],
    paese:
      destParty.paese || f['Destinatario_Paese'] || f['Paese Destinatario'],
    telefono:
      destParty.telefono ||
      f['Destinatario_Telefono'] ||
      f['Telefono Destinatario'],
    taxId:
      destParty.taxId ||
      f['Destinatario_Tax'] ||
      f['Destinatario_EORI'] ||
      f['Dest_TaxID'] ||
      f['TaxID Destinatario'],
  };

  // ---- colli --------------------------------------------------------
  const colli = useMemo(() => {
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

      {/* HEADER */}
      <div className="rounded-xl border bg-white p-4 shadow-sm">
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <div className="text-xs uppercase text-slate-500">ID preventivo</div>
            <div className="font-medium break-all">{displayId}</div>
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
          <div>
            <div className="text-xs uppercase text-slate-500">Valuta</div>
            <div className="font-medium">{valuta}</div>
          </div>
        </div>
      </div>

      {/* META EMAIL / NOTE */}
      <div className="rounded-xl border bg-white p-4 shadow-sm">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <div className="text-xs uppercase text-slate-500">Email cliente</div>
            <div className="font-medium break-all">{emailCliente}</div>
            <div className="mt-2 text-xs uppercase text-slate-500">
              Creato da (email)
            </div>
            <div className="font-medium break-all">{creatoDaEmail}</div>
          </div>
          <div>
            <div className="text-xs uppercase text-slate-500">
              Note generiche sulla spedizione
            </div>
            <div className="mt-1 text-sm text-slate-700 whitespace-pre-wrap">
              {noteGeneriche || '—'}
            </div>
          </div>
        </div>
      </div>

      {/* MITTENTE / DESTINATARIO */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border bg-white p-4 shadow-sm">
          <div className="text-sm font-semibold">Mittente</div>
          <div className="mt-1 text-sm text-slate-700 space-y-1">
            <div className="font-medium">{mitt.nome || '—'}</div>
            {mitt.referente && (
              <div className="text-slate-600 text-xs">
                Referente: <span className="font-medium">{mitt.referente}</span>
              </div>
            )}
            <div className="text-slate-500">
              {[mitt.ind, [mitt.cap, mitt.citta].filter(Boolean).join(' '), mitt.paese]
                .filter(Boolean)
                .join(', ') || '—'}
            </div>
            {mitt.telefono && (
              <div className="text-slate-500 text-xs">
                Tel:{' '}
                <span className="font-medium">{mitt.telefono}</span>
              </div>
            )}
            {mitt.taxId && (
              <div className="text-slate-500 text-xs">
                Tax ID:{' '}
                <span className="font-medium">{mitt.taxId}</span>
              </div>
            )}
          </div>
        </div>

        <div className="rounded-xl border bg-white p-4 shadow-sm">
          <div className="text-sm font-semibold">Destinatario</div>
          <div className="mt-1 text-sm text-slate-700 space-y-1">
            <div className="font-medium">{dest.nome || '—'}</div>
            {dest.referente && (
              <div className="text-slate-600 text-xs">
                Referente: <span className="font-medium">{dest.referente}</span>
              </div>
            )}
            <div className="text-slate-500">
              {[dest.ind, [dest.cap, dest.citta].filter(Boolean).join(' '), dest.paese]
                .filter(Boolean)
                .join(', ') || '—'}
            </div>
            {dest.telefono && (
              <div className="text-slate-500 text-xs">
                Tel:{' '}
                <span className="font-medium">{dest.telefono}</span>
              </div>
            )}
            {dest.taxId && (
              <div className="text-slate-500 text-xs">
                Tax ID:{' '}
                <span className="font-medium">{dest.taxId}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* COLLI */}
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
