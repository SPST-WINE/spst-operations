// components/SpedizioniClient.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import { Package, Boxes, Search, ArrowUpDown } from 'lucide-react';
import Drawer from '@/components/Drawer';
import ShipmentDetail from '@/components/ShipmentDetail';
import { createClient } from '@supabase/supabase-js';

/* ---------- Supabase browser client ---------- */
const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL || (process.env as any).SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(SUPABASE_URL!, SUPABASE_ANON_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
});

/* ---------- Types ---------- */
type RowDb = {
  id: string;
  human_id: string | null;
  created_at: string;
  status: string | null;
  tipo_spedizione: string | null;
  incoterm: string | null;
  giorno_ritiro: string | null;
  note_ritiro: string | null;
  colli_n: number | null;
  peso_reale_kg: number | string | null;
  mittente_paese: string | null;
  mittente_citta: string | null;
  dest_paese: string | null;
  dest_citta: string | null;
  carrier: string | null;
  tracking_code: string | null;
  email_norm: string | null;
  fields?: any; // payload extra salvato in API
};

type ApiList = {
  ok: boolean;
  page: number;
  limit: number;
  total: number;
  rows: RowDb[];
};

type RowUi = {
  id: string;              // uuid
  ref: string;             // human_id || id
  _createdTime?: string;   // per ordinamento “storico”
  fields: any;             // shape legacy per ShipmentDetail/Drawer
};

/* ---------- util ---------- */
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

  if (v.includes('in transito') || v.includes('intransit')) cls = 'bg-sky-50 text-sky-700 ring-sky-200';
  else if (v.includes('in consegna') || v.includes('outfordelivery')) cls = 'bg-amber-50 text-amber-700 ring-amber-200';
  else if (v.includes('consegn')) cls = 'bg-emerald-50 text-emerald-700 ring-emerald-200';
  else if (v.includes('eccez') || v.includes('exception') || v.includes('failed')) cls = 'bg-rose-50 text-rose-700 ring-rose-200';

  return <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs ring-1 ${cls}`}>{text}</span>;
}

type Att = { url: string; filename?: string };
const DocButtons = ({ f }: { f: any }) => {
  // nel nuovo schema i documenti non sono ancora allegati: gestiamo gracefully “vuoto”
  const Btn = ({ href, label }: { href: string; label: string }) => (
    <a
      href={href}
      target="_blank"
      className="inline-flex items-center rounded-md bg-[#1c3e5e] px-2.5 py-1 text-xs font-medium text-white hover:opacity-95"
    >
      {label}
    </a>
  );

  const extras: Att[] = [];
  const hasAny = extras.length > 0;

  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {!hasAny ? (
        <span className="text-xs text-slate-400">Nessun documento allegato</span>
      ) : (
        extras.map((e, i) => <Btn key={`${e.url}-${i}`} href={e.url} label="Allegato" />)
      )}
    </div>
  );
};

/* Mappa una riga DB → “fields” legacy (compatibile con ShipmentDetail) */
function mapDbToLegacyFields(r: RowDb) {
  const f = r.fields || {};
  const mitt = f.mittente || {};
  const dest = f.destinatario || {};
  const fatt = f.fatturazione || {};
  const sameAsDest = !!f.fattSameAsDest;
  const delega = !!f.fattDelega;

  // Colli: se presenti nel payload salvato dal POST
  const colli = Array.isArray(f.colli) ? f.colli : [];

  return {
    // riferimenti
    'ID Spedizione': r.human_id || r.id,
    'Creato il': r.created_at,
    'Stato': r.status || 'draft',

    // mittente
    'Mittente - Ragione Sociale': mitt.ragioneSociale || '',
    'Mittente - Indirizzo': mitt.indirizzo || '',
    'Mittente - Città': r.mittente_citta || mitt.citta || '',
    'Mittente - Paese': r.mittente_paese || mitt.paese || '',
    'Mittente - Tel': mitt.telefono || '',

    // destinatario
    'Destinatario - Ragione Sociale': dest.ragioneSociale || '',
    'Destinatario - Indirizzo': dest.indirizzo || '',
    'Destinatario - Città': r.dest_citta || dest.citta || '',
    'Destinatario - Paese': r.dest_paese || dest.paese || '',
    'Destinatario - Tel': dest.telefono || '',
    'Abilitato import': (r as any).dest_abilitato_import ? 'Sì' : 'No',

    // ritiro / incoterm
    'Ritiro - Data': r.giorno_ritiro || '',
    'Ritiro - Note': r.note_ritiro || '',
    'Incoterm': r.incoterm || '',
    'Tipo spedizione': r.tipo_spedizione || '',

    // fatturazione
    'Fatturazione - Ragione Sociale': fatt.ragioneSociale || '',
    'P.IVA/CF': fatt.piva || fatt.piva_cf || '',
    'Uguale a Destinatario': sameAsDest ? 'Sì' : 'No',
    'Delega fattura a SPST': delega ? 'Sì' : 'No',

    // colli / pesi
    'Colli (n)': r.colli_n ?? '',
    'Peso (kg)': r.peso_reale_kg ?? '',
    'Colli': colli, // il Drawer cerca questo array

    // tracking (placeholder)
    'Tracking - Corriere': r.carrier || '',
    'Tracking - Codice': r.tracking_code || '',
  };
}


function Card({ r, onDetails }: { r: RowUi; onDetails: () => void }) {
  const f = r.fields;
  const ref = f['ID Spedizione'] || r.ref;
  const formato = (r.fields?.Formato as string) || '';
  const isPallet = /pallet/i.test(formato);

  const destRS = f['Destinatario - Ragione Sociale'] || '';
  const destCitta = f['Destinatario - Città'];
  const destPaese = f['Destinatario - Paese'];
  const dest =
    destCitta || destPaese
      ? `${destCitta || ''}${destCitta && destPaese ? ' ' : ''}${destPaese ? ` (${destPaese})` : ''}`
      : '—';
  const stato = f['Stato'] || '—';

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm hover:shadow-md transition-shadow min-h-[112px] flex items-start gap-4">
      <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-700 shrink-0">
        {isPallet ? <Boxes className="h-5 w-5" /> : <Package className="h-5 w-5" />}
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="font-semibold text-slate-900 truncate">{ref}</div>
            {destRS ? (
              <div className="text-sm text-slate-700 truncate">Destinatario: {destRS}</div>
            ) : null}
            <div className="text-sm text-slate-500 truncate">Destinazione: {dest}</div>
          </div>
          <StatusBadge value={stato} />
        </div>

        <DocButtons f={f} />

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
  const [rows, setRows] = useState<RowUi[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [sort, setSort] = useState<'created_desc' | 'ritiro_desc' | 'dest_az' | 'status'>('created_desc');

  const [open, setOpen] = useState(false);
  const [sel, setSel] = useState<RowUi | null>(null);

  useEffect(() => {
    let alive = true;

    async function load() {
      setLoading(true);
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData?.session?.access_token || null;

        const params = new URLSearchParams();
        if (q.trim()) params.set('q', q.trim());
        params.set('sort', 'created_desc'); // lato API puoi ignorarlo; ordiniamo client-side
        params.set('limit', '200');

        const res = await fetch(`/api/spedizioni?${params.toString()}`, {
          method: 'GET',
          credentials: 'include',
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          cache: 'no-store',
        });

        const j: ApiList | any = await res.json().catch(() => ({}));
        if (!alive) return;

        if (res.ok && j?.ok) {
          const ui: RowUi[] = (j.rows || []).map((r: RowDb) => ({
            id: r.id,
            ref: r.human_id || r.id,
            _createdTime: r.created_at,
            fields: mapDbToLegacyFields(r),
          }));
          setRows(ui);
        } else {
          setRows([]);
        }
      } catch (e) {
        if (alive) setRows([]);
      } finally {
        if (alive) setLoading(false);
      }
    }

    load();
    return () => {
      alive = false;
    };
  }, [q]);

  const filtered = useMemo(() => {
    const needle = norm(q);
    const arr = !needle
      ? rows
      : rows.filter(r => {
          const f = r.fields || {};
          const hay = [
            f['ID Spedizione'],
            f['Destinatario - Ragione Sociale'],
            f['Destinatario - Città'],
            f['Destinatario - Paese'],
            f['Mittente - Ragione Sociale'],
          ]
            .map(norm)
            .join(' | ');
          return hay.includes(needle);
        });

    const copy = [...arr];
    copy.sort((a, b) => {
      const fa = a.fields || {};
      const fb = b.fields || {};

      if (sort === 'ritiro_desc') {
        const da = fa['Ritiro - Data'] ? new Date(fa['Ritiro - Data']).getTime() : 0;
        const db = fb['Ritiro - Data'] ? new Date(fb['Ritiro - Data']).getTime() : 0;
        return db - da;
      }
      if (sort === 'dest_az') {
        const aa = `${fa['Destinatario - Città'] || ''} ${fa['Destinatario - Paese'] || ''}`.toLowerCase();
        const bb = `${fb['Destinatario - Città'] || ''} ${fb['Destinatario - Paese'] || ''}`.toLowerCase();
        return aa.localeCompare(bb);
      }
      if (sort === 'status') {
        const order = (s?: string) => {
          const v = (s || '').toLowerCase();
          if (v.includes('in transito') || v.includes('intransit')) return 2;
          if (v.includes('in consegna') || v.includes('outfordelivery')) return 1;
          if (v.includes('consegn')) return 0;
          if (v.includes('eccez') || v.includes('exception') || v.includes('failed')) return 3;
          return 4;
        };
        return order(fa['Stato']) - order(fb['Stato']);
      }
      // created_desc
      const ca = a._createdTime ? new Date(a._createdTime).getTime() : 0;
      const cb = b._createdTime ? new Date(b._createdTime).getTime() : 0;
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

      {/* Drawer dettagli: ShipmentDetail continua a ricevere la mappa “fields” */}
      <Drawer open={open} onClose={() => setOpen(false)} title={sel ? (sel.fields?.['ID Spedizione'] || sel.ref) : undefined}>
        {sel ? <ShipmentDetail f={sel.fields} /> : null}
      </Drawer>
    </>
  );
}
