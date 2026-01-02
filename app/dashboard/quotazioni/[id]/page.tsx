// app/dashboard/quotazioni/[id]/page.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Loader2, CheckCircle2 } from 'lucide-react';

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

type QuoteOption = {
  id: string;
  label?: string | null;
  carrier?: string | null;
  service_name?: string | null;
  transit_time?: string | null;
  freight_price?: number | null;
  customs_price?: number | null;
  total_price?: number | null;
  currency?: string | null;
  public_notes?: string | null;
  status?: string | null;
  show_vat?: boolean | null;
  vat_rate?: number | null;
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

function formatCurrency(amount?: number | null, currency?: string | null) {
  if (amount == null || !Number.isFinite(amount)) return '—';
  const curr = (currency || 'EUR').toUpperCase();
  return new Intl.NumberFormat('it-IT', {
    style: 'currency',
    currency: curr,
  }).format(amount);
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

export default function QuoteDetailPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [row, setRow] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const id = decodeURIComponent(params.id);

  useEffect(() => {
    let abort = false;
    (async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/quotazioni/${id}`, {
          cache: 'no-store',
        });
        const data = await res.json().catch(() => ({}));

        if (!res.ok || !data?.ok) {
          if (!abort) {
            setError('Quotazione non trovata o non autorizzata');
            setRow(null);
          }
          return;
        }

        if (!abort) setRow(data.row);
      } catch (e) {
        console.error('[quotazioni/:id] errore', e);
        if (!abort) {
          setError('Errore nel caricamento della quotazione');
          setRow(null);
        }
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
  const stato = row?.status || f['Stato'] || 'IN LAVORAZIONE';
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

  // nuovo: contenuto colli (dal JSON/DB)
  const contenutoColli: string =
    (f['contenutoColli'] as string | undefined) ??
    (f['contenuto_colli'] as string | undefined) ??
    '';

  // ---- mittente / destinatario -------------------------------------
  const mittParty: QuoteParty = (f.mittente || row?.fields?.mittente || {}) as QuoteParty;
  const destParty: QuoteParty = (row?.destinatario || f.destinatario || {}) as QuoteParty;

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

  // ---- opzioni disponibili ------------------------------------------
  const availableOptions: QuoteOption[] = Array.isArray(row?.available_options)
    ? row.available_options
    : [];
  const acceptedOption: QuoteOption | null = row?.accepted_option || null;
  const isDisponibile = stato === 'DISPONIBILE';
  const isAccettata = stato === 'ACCETTATA';

  async function handleAccept(optionId: string) {
    if (isAccettata || !isDisponibile) return;

    setAccepting(optionId);
    setError(null);

    try {
      const res = await fetch(`/api/quotazioni/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ option_id: optionId }),
      });

      const json = await res.json().catch(() => ({}));

      if (!res.ok || !json?.ok) {
        setError(
          json?.error === 'INVALID_OPTION'
            ? 'Questa opzione non è più selezionabile.'
            : 'Si è verificato un errore nella conferma della quotazione.'
        );
        return;
      }

      // Ricarica la pagina per vedere lo stato aggiornato
      router.refresh();
      window.location.reload();
    } catch (e) {
      console.error('[quotazioni/:id] accept error:', e);
      setError('Si è verificato un errore nella conferma della quotazione.');
    } finally {
      setAccepting(null);
    }
  }

  if (loading) {
    return <div className="p-6 text-sm text-slate-600">Caricamento…</div>;
  }
  if (!row || error) {
    return (
      <div className="p-6">
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">
          {error || 'Preventivo non trovato.'}
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
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Dettaglio preventivo</h2>
        <StatusBadge value={stato} />
      </div>

      {/* HEADER */}
      <div className="rounded-xl border bg-white p-4 shadow-sm">
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <div className="text-xs uppercase text-slate-500">ID preventivo</div>
            <div className="font-medium break-all">{displayId}</div>
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
          <div>
            <div className="text-xs uppercase text-slate-500">Formato</div>
            <div className="font-medium">{row.formato_sped || '—'}</div>
          </div>
          <div>
            <div className="text-xs uppercase text-slate-500">Colli</div>
            <div className="font-medium">{row.colli_n || colli.length || '—'}</div>
          </div>
        </div>
      </div>

      {/* META EMAIL / NOTE + CONTENUTO COLLI */}
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

            <div className="mt-4 border-t border-slate-100 pt-3">
              <div className="text-xs uppercase text-slate-500">
                Contenuto colli
              </div>
              <div className="mt-1 text-sm text-slate-700 whitespace-pre-wrap">
                {contenutoColli || '—'}
              </div>
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

      {/* OPZIONI DISPONIBILI / ACCETTATA */}
      {isDisponibile && availableOptions.length > 0 && (
        <div className="rounded-xl border bg-white p-4 shadow-sm">
          <div className="mb-4 text-sm font-semibold">Opzioni disponibili</div>
          <div className="space-y-3">
            {availableOptions.map((opt) => {
              const isAccepted = acceptedOption?.id === opt.id;
              const isAccepting = accepting === opt.id;

              return (
                <div
                  key={opt.id}
                  className={`rounded-lg border p-4 ${
                    isAccepted
                      ? 'border-emerald-200 bg-emerald-50'
                      : 'border-slate-200 bg-white'
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="font-medium text-slate-900">
                        {opt.label || opt.carrier || 'Opzione'}
                      </div>
                      {opt.carrier && (
                        <div className="mt-1 text-xs text-slate-600">
                          Corriere: {opt.carrier}
                          {opt.service_name && ` • ${opt.service_name}`}
                        </div>
                      )}
                      {opt.transit_time && (
                        <div className="mt-1 text-xs text-slate-500">
                          Tempo di transito: {opt.transit_time}
                        </div>
                      )}
                      {opt.public_notes && (
                        <div className="mt-2 text-xs text-slate-600">
                          {opt.public_notes}
                        </div>
                      )}
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-semibold text-slate-900">
                        {formatCurrency(opt.total_price, opt.currency)}
                      </div>
                      {opt.freight_price && opt.customs_price && (
                        <div className="mt-1 text-xs text-slate-500">
                          {formatCurrency(opt.freight_price, opt.currency)} +{' '}
                          {formatCurrency(opt.customs_price, opt.currency)}
                        </div>
                      )}
                      {!isAccettata && (
                        <button
                          onClick={() => handleAccept(opt.id)}
                          disabled={isAccepting || isAccepted}
                          className={`mt-2 rounded-lg px-4 py-2 text-xs font-medium transition ${
                            isAccepted
                              ? 'bg-emerald-100 text-emerald-700 cursor-default'
                              : 'bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-50'
                          }`}
                        >
                          {isAccepting ? (
                            <span className="flex items-center gap-1">
                              <Loader2 className="h-3 w-3 animate-spin" />
                              Accettazione...
                            </span>
                          ) : isAccepted ? (
                            <span className="flex items-center gap-1">
                              <CheckCircle2 className="h-3 w-3" />
                              Accettata
                            </span>
                          ) : (
                            'Accetta questa opzione'
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {isAccettata && acceptedOption && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 shadow-sm">
          <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-emerald-800">
            <CheckCircle2 className="h-4 w-4" />
            Quotazione accettata
          </div>
          <div className="space-y-2 text-sm text-emerald-700">
            <div>
              <span className="font-medium">Opzione scelta:</span>{' '}
              {acceptedOption.label || acceptedOption.carrier || 'Opzione accettata'}
            </div>
            <div>
              <span className="font-medium">Prezzo totale:</span>{' '}
              {formatCurrency(acceptedOption.total_price, acceptedOption.currency)}
            </div>
            {acceptedOption.carrier && (
              <div>
                <span className="font-medium">Corriere:</span> {acceptedOption.carrier}
                {acceptedOption.service_name && ` • ${acceptedOption.service_name}`}
              </div>
            )}
          </div>
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

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
