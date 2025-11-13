// components/SpedizioniClient.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import { Package, Boxes, Search, ArrowUpDown } from 'lucide-react';
import Drawer from '@/components/Drawer';
import ShipmentDetail from '@/components/ShipmentDetail';
import { getIdToken } from '@/lib/firebase-client-auth';

type Row = {
  id: string;
  created_at?: string | null;
  human_id?: string | null;
  tipo_spedizione?: string | null;
  incoterm?: string | null;
  giorno_ritiro?: string | null;
  mittente_citta?: string | null;
  dest_citta?: string | null;
  dest_paese?: string | null;
  colli_n?: number | null;
  peso_reale_kg?: number | string | null;
  status?: string | null;
  email_norm?: string | null;
  [k: string]: any;
};

function norm(s?: string) {
  return (s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '');
}

function StatusBadge({ value }: { value?: string | null }) {
  const v = (value || '').toLowerCase();
  let cls = 'bg-amber-50 text-amber-700 ring-amber-200';
  let text = value || '—';

  if (v.includes('in transito')) cls = 'bg-sky-50 text-sky-700 ring-sky-200';
  else if (v.includes('in consegna')) cls = 'bg-amber-50 text-amber-700 ring-amber-200';
  else if (v.includes('consegn')) cls = 'bg-emerald-50 text-emerald-700 ring-emerald-200';
  else if (v.includes('eccez') || v.includes('exception') || v.includes('failed')) cls = 'bg-rose-50 text-rose-700 ring-rose-200';

  return <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs ring-1 ${cls}`}>{text}</span>;
}

function Card({ r, onDetails }: { r: Row; onDetails: () => void }) {
  const isPallet = /pallet/i.test(String(r.formato || ''));
  const ref = r.human_id || r.id;

  const destRS = r.dest_ragione_sociale || r['Destinatario - Ragione Sociale'] || '';
  const dest =
    r.dest_citta || r.dest_paese
      ? `${r.dest_citta || ''}${r.dest_citta && r.dest_paese ? ' ' : ''}${r.dest_paese ? ` (${r.dest_paese})` : ''}`
      : '—';

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
          <StatusBadge value={r.status} />
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

        // Auth headers
        const headers: HeadersInit = {};
        try {
          const token = await getIdToken();
          if (token) headers['Authorization'] = `Bearer ${token}`;
        } catch {}

        // Fallback per debug: se non abbiamo Bearer, prova con email localStorage
        if (!('Authorization' in headers)) {
          const email = typeof window !== 'undefined' ? localStorage.getItem('userEmail') : '';
          if (email) params.set('email', email);
        }

        // Aggiungo debug per vedere cosa torna
        console.log("SPST[spedizioni] Auth via Supabase session OK (token)", 'Authorization' in headers);
        console.log("SPST[spedizioni] Email da localStorage:", typeof window !== 'undefined' ? localStorage.getItem('userEmail') : null);

        const res = await fetch(`/api/spedizioni?${params.toString()}`, {
          headers,
          cache: 'no-store',
        });
        const j = await res.json().catch(() => ({}));

        console.log("SPST[spedizioni] → /api/spedizioni response", { status: res.status, ok: res.ok, body: j });

        if (!alive) return;

        if (j?.ok) {
          const arr: Row[] = Array.isArray(j.rows) ? j.rows : [];
          console.log("SPST[spedizioni] righe parse:", arr.length, arr);
          setRows(arr);
        } else {
          setRows([]);
        }
      } catch (e) {
        console.error("SPST[spedizioni] fetch error:", e);
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
            r.dest_citta,
            r.dest_paese,
            r.mittente_citta,
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
          if (v.includes('in transito')) return 2;
          if (v.includes('in consegna')) return 1;
          if (v.includes('consegn')) return 0;
          if (v.includes('eccez') || v.includes('exception') || v.includes('failed')) return 3;
          return 4;
        };
        return order(a.status) - order(b.status);
      }
      // created_desc
      const ca = a.created_at ? new Date(a.created_at).getTime() : 0;
      const cb = b.created_at ? new Date(b.created_at).getTime() : 0;
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

      {/* Lista */}
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
        {/* ShipmentDetail si aspetta un "f" stile fields; gli passo direttamente l'oggetto semplice */}
        {sel ? <ShipmentDetail f={sel as any} /> : null}
      </Drawer>
    </>
  );
}
