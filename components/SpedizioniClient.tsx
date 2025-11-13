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
  mittente_ragione_sociale?: string | null;
  mittente_citta?: string | null;
  mittente_paese?: string | null;
  mittente_cap?: string | null;
  mittente_indirizzo?: string | null;
  dest_ragione_sociale?: string | null;
  dest_citta?: string | null;
  dest_paese?: string | null;
  dest_cap?: string | null;
  dest_indirizzo?: string | null;
  dest_abilitato_import?: boolean | null;
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
  const destRS = r.dest_ragione_sociale || '';
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

/** Adapter: Supabase row -> chiavi “Airtable-like” usate da ShipmentDetail */
function toFMap(r: Row) {
  return {
    // Header
    'ID Spedizione': r.human_id || r.id,
    // Mittente
    'Mittente - Ragione Sociale': r.mittente_ragione_sociale || null,
    'Mittente - Città': r.mittente_citta || null,
    'Mittente - Paese': r.mittente_paese || null,
    'Mittente - CAP': r.mittente_cap || null,
    'Mittente - Indirizzo': r.mittente_indirizzo || null,
    'Mittente - Telefono': r.mittente_telefono || null,
    // Destinatario
    'Destinatario - Ragione Sociale': r.dest_ragione_sociale || null,
    'Destinatario - Città': r.dest_citta || null,
    'Destinatario - Paese': r.dest_paese || null,
    'Destinatario - CAP': r.dest_cap || null,
    'Destinatario - Indirizzo': r.dest_indirizzo || null,
    'Destinatario - Telefono': r.dest_telefono || null,
    'Destinatario - Abilitato Import': r.dest_abilitato_import ? 'Sì' : 'No',
    // Dati spedizione
    'Ritiro - Data': r.giorno_ritiro || null,
    'Incoterm': r.incoterm || null,
    'Tipo spedizione': r.tipo_spedizione || null,
    // Fatturazione (placeholder se non hai ancora i campi)
    'Fatturazione - Ragione Sociale': r.fatt_ragione_sociale || null,
    'Fatturazione - P.IVA/CF': r.fatt_piva_cf || null,
    'Fatturazione - Uguale a Destinatario': r.fatt_uguale_dest ? 'Sì' : 'No',
    'Fatturazione - Delega fattura a SPST': r.fatt_delega_spst ? 'Sì' : 'No',
    // Colli
    'Colli - Numero': r.colli_n ?? null,
    'Peso (kg)': r.peso_reale_kg ?? null,
    // Stato
    'Stato': r.status || null,
    // Allegati (se/quando li avrai)
    'Allegato LDV': r.ldv_url ? [{ url: r.ldv_url, filename: 'LDV.pdf' }] : [],
    'Allegato Fattura': r.fattura_url ? [{ url: r.fattura_url, filename: 'Fattura.pdf' }] : [],
    'Allegato PL': r.pl_url ? [{ url: r.pl_url, filename: 'PackingList.pdf' }] : [],
    'Allegato DLE': r.dle_url ? [{ url: r.dle_url, filename: 'DLE.pdf' }] : [],
  };
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

        const headers: HeadersInit = {};
        try {
          const token = await getIdToken();
          if (token) headers['Authorization'] = `Bearer ${token}`;
        } catch {}
        if (!('Authorization' in headers)) {
          const email = typeof window !== 'undefined' ? localStorage.getItem('userEmail') : '';
          if (email) params.set('email', email);
        }

        const res = await fetch(`/api/spedizioni?${params.toString()}`, { headers, cache: 'no-store' });
        const j = await res.json().catch(() => ({}));
        console.log("SPST[spedizioni] → /api/spedizioni", { status: res.status, body: j });

        if (!alive) return;
        setRows(Array.isArray(j?.rows) ? j.rows : []);
      } catch (e) {
        console.error("SPST[spedizioni] fetch error:", e);
        if (alive) setRows([]);
      } finally {
        if (alive) setLoading(false);
      }
    }
    load();
    return () => { alive = false; };
  }, [q, sort]);

  const filtered = useMemo(() => {
    const needle = norm(q);
    const arr = !needle
      ? rows
      : rows.filter(r => {
          const hay = [r.human_id, r.dest_citta, r.dest_paese, r.mittente_citta].map(norm).join(' | ');
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
        {sel ? <ShipmentDetail f={toFMap(sel)} /> : null}
      </Drawer>
    </>
  );
}
