// components/SpedizioniClient.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import { Package, Boxes, Search, ArrowUpDown } from 'lucide-react';
import Drawer from '@/components/Drawer';
import ShipmentDetail from '@/components/ShipmentDetail';
import { getIdToken } from '@/lib/firebase-client-auth';

/* ------------------------- tipi (in linea con l'API) ------------------------- */
type Pkg = {
  id: string;
  l1: number | null;
  l2: number | null;
  l3: number | null;
  weight_kg: number | null;
  contenuto?: string | null;
};

type Row = {
  id: string;
  human_id?: string | null;
  created_at?: string | null;
  created_it?: string | null;

  // principali
  tipo_spedizione?: string | null;
  incoterm?: string | null;
  giorno_ritiro?: string | null;
  status?: string | null;

  // mittente
  mittente_rs?: string | null;
  mittente_paese?: string | null;
  mittente_citta?: string | null;
  mittente_cap?: string | null;
  mittente_indirizzo?: string | null;
  mittente_telefono?: string | null;
  mittente_piva?: string | null;

  // destinatario
  dest_rs?: string | null;
  dest_paese?: string | null;
  dest_citta?: string | null;
  dest_cap?: string | null;
  dest_telefono?: string | null;
  dest_piva?: string | null;
  dest_abilitato_import?: boolean | null;

  // fatturazione
  fatt_rs?: string | null;
  fatt_piva?: string | null;
  fatt_valuta?: string | null;

  // colli / payload
  colli_n?: number | null;
  peso_reale_kg?: string | number | null;
  formato_sped?: string | null;
  contenuto_generale?: string | null;

  // anteprima colli (server)
  packages_count?: number;
  packages_preview?: Pkg[];

  // blob originale per retro-compat
  fields?: any;
};

/* --------------------------------- helpers ---------------------------------- */
function norm(s?: string) {
  return (s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '');
}

/* --------------------------------- UI bits ---------------------------------- */
function StatusBadge({ value }: { value?: string | null }) {
  const v = (value || '').toLowerCase();
  let cls = 'bg-amber-50 text-amber-700 ring-amber-200';
  if (v.includes('in transito') || v.includes('intransit')) cls = 'bg-sky-50 text-sky-700 ring-sky-200';
  else if (v.includes('in consegna') || v.includes('outfordelivery')) cls = 'bg-amber-50 text-amber-700 ring-amber-200';
  else if (v.includes('consegn')) cls = 'bg-emerald-50 text-emerald-700 ring-emerald-200';
  else if (v.includes('eccez') || v.includes('exception') || v.includes('failed')) cls = 'bg-rose-50 text-rose-700 ring-rose-200';
  return <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs ring-1 ${cls}`}>{value || '—'}</span>;
}

function Card({ r, onDetails }: { r: Row; onDetails: () => void }) {
  const isPallet = /pallet/i.test(r.formato_sped || r.fields?.formato || '');
  const ref = r.human_id || r.id;

  const destRS = r.dest_rs || r.fields?.['Destinatario - Ragione Sociale'] || '';
  const dest = [r.dest_citta, r.dest_paese].filter(Boolean).join(' ') || '—';
  const stato = r.status || '—';

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm hover:shadow-md transition-shadow min-h-[112px] flex items-start gap-4">
      <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-700 shrink-0">
        {isPallet ? <Boxes className="h-5 w-5" /> : <Package className="h-5 w-5" />}
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="font-semibold text-slate-900 truncate">{ref}</div>
            {destRS ? <div className="text-sm text-slate-700 truncate">Destinatario: {destRS}</div> : null}
            <div className="text-sm text-slate-500 truncate">Destinazione: {dest}</div>
          </div>
          <StatusBadge value={stato} />
        </div>

        <div className="mt-3">
          <button onClick={onDetails} className="text-xs text-[#1c3e5e] underline">
            Mostra dettagli
          </button>
        </div>
      </div>
    </div>
  );
}

/* --------------------------------- main cmp --------------------------------- */
export default function SpedizioniClient() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [sort, setSort] = useState<'created_desc' | 'ritiro_desc' | 'dest_az' | 'status'>('created_desc');

  const [open, setOpen] = useState(false);
  const [sel, setSel] = useState<Row | null>(null);

  useEffect(() => {
    let alive = true;

    async function load() {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (q.trim()) params.set('q', q.trim());
        if (sort) params.set('sort', sort);

        // Auth: Bearer da Firebase se disponibile, altrimenti fallback email da localStorage
        const headers: HeadersInit = {};
        let emailFallback = '';

        try {
          const token = await getIdToken();
          if (token) {
            headers['Authorization'] = `Bearer ${token}`;
            console.debug('SPST[spedizioni] Auth via Supabase session OK (token)');
          } else {
            console.debug('SPST[spedizioni] Auth via Supabase session KO (token assente)');
          }
        } catch {
          console.debug('SPST[spedizioni] Auth token fetch error (ignored)');
        }

        if (!('Authorization' in headers)) {
          emailFallback = typeof window !== 'undefined' ? (localStorage.getItem('userEmail') || '') : '';
          if (emailFallback) params.set('email', emailFallback);
          console.debug('SPST[spedizioni] email da localStorage:', emailFallback || '(vuota)');
        }

        const url = `/api/spedizioni?${params.toString()}`;
        console.debug('SPST[spedizioni] → GET', url, { query: Object.fromEntries(params), headers });

        const res = await fetch(url, { headers, cache: 'no-store' });
        const body = await res.json().catch(() => ({}));

        console.debug('SPST[spedizioni] ← /api/spedizioni response', { status: res.status, ok: body?.ok, body });

        if (!alive) return;

        if (res.ok && body?.ok) {
          // l'API già ritorna righe con campi normalizzati: le usiamo direttamente
          const arr: Row[] = Array.isArray(body.rows) ? body.rows : [];
          console.debug('SPST[spedizioni] righe parse:', arr.length, arr.slice(0, 2));
          setRows(arr);
        } else {
          setRows([]);
        }
      } catch (e) {
        console.warn('SPST[spedizioni] load error:', e);
        if (alive) setRows([]);
      } finally {
        if (alive) setLoading(false);
      }
    }

    load();
    return () => {
      alive = false;
    };
  }, [q, sort]);

  const filtered = useMemo(() => {
    const needle = norm(q);
    const arr = !needle
      ? rows
      : rows.filter(r => {
          const hay = [
            r.human_id,
            r.dest_rs,
            r.dest_citta,
            r.dest_paese,
            r.mittente_rs,
          ]
            .map(norm)
            .join(' | ');
          return hay.includes(needle);
        });

    const copy = [...arr];
    copy.sort((a, b) => {
      if (sort === 'ritiro_desc') {
        const da = a.giorno_ritiro ? new Date(a.giorno_ritiro).getTime() : 0;
        const db = b.giorno_ritiro ? new Date(b.giorno_ritiro).getTime() : 0;
        return db - da;
      }
      if (sort === 'dest_az') {
        const aa = `${a.dest_citta || ''} ${a.dest_paese || ''}`.toLowerCase();
        const bb = `${b.dest_citta || ''} ${b.dest_paese || ''}`.toLowerCase();
        return aa.localeCompare(bb);
      }
      if (sort === 'status') {
        const order = (s?: string | null) => {
          const v = (s || '').toLowerCase();
          if (v.includes('in transito') || v.includes('intransit')) return 2;
          if (v.includes('in consegna') || v.includes('outfordelivery')) return 1;
          if (v.includes('consegn')) return 0;
          if (v.includes('eccez') || v.includes('exception') || v.includes('failed')) return 3;
          return 4;
        };
        return order(a.status) - order(b.status);
      }
      // created_desc
      const ca = a.created_it ? new Date(a.created_it).getTime() : (a.created_at ? new Date(a.created_at).getTime() : 0);
      const cb = b.created_it ? new Date(b.created_it).getTime() : (b.created_at ? new Date(b.created_at).getTime() : 0);
      return cb - ca;
    });

    return copy;
  }, [rows, q, sort]);

  return (
    <>
      {/* Toolbar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-slate-400" />
          <input
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder="Cerca: destinatario, città, paese, ID…"
            className="pl-8 pr-3 py-2 text-sm rounded-lg border bg-white w-72"
          />
        </div>
        <div className="relative">
          <ArrowUpDown className="absolute left-2 top-2.5 h-4 w-4 text-slate-400" />
          <select
            value={sort}
            onChange={e => setSort(e.target.value as any)}
            className="pl-8 pr-3 py-2 text-sm rounded-lg border bg-white"
            title="Ordina per"
          >
            <option value="created_desc">Data creazione (nuove prima)</option>
            <option value="ritiro_desc">Data ritiro (recenti prima)</option>
            <option value="dest_az">Destinazione A → Z</option>
            <option value="status">Stato</option>
          </select>
        </div>
      </div>

      {/* Lista 1 card per riga */}
      {loading ? (
        <div className="text-sm text-slate-500">Caricamento…</div>
      ) : filtered.length === 0 ? (
        <div className="text-sm text-slate-500">Nessuna spedizione trovata.</div>
      ) : (
        <div className="space-y-3">
          {filtered.map(r => (
            <Card key={r.id} r={r} onDetails={() => { setSel(r); setOpen(true); }} />
          ))}
        </div>
      )}

      {/* Drawer dettagli */}
      <Drawer open={open} onClose={() => setOpen(false)} title={sel ? (sel.human_id || sel.id) : undefined}>
        {sel ? <ShipmentDetail f={sel} /> : null}
      </Drawer>
    </>
  );
}
