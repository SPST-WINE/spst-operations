// components/SpedizioniClient.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import { Package, Boxes, Search, ArrowUpDown } from 'lucide-react';
import Drawer from '@/components/Drawer';
import ShipmentDetail from '@/components/ShipmentDetail';
import { getIdToken } from '@/lib/firebase-client-auth';
import { createClient } from '@supabase/supabase-js';

type Row = {
  id: string;
  _createdTime?: string | null;
  [key: string]: any;
};

function norm(s?: string) {
  return (s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '');
}

function log(...a: any[]) {
  // tutti i log hanno lo stesso prefisso per filtrarli facilmente in console
  console.log('%cSPST[spedizioni]', 'color:#1c3e5e;font-weight:600', ...a);
}

function warn(...a: any[]) {
  console.warn('SPST[spedizioni]', ...a);
}

function error(...a: any[]) {
  console.error('SPST[spedizioni]', ...a);
}

function StatusBadge({ value }: { value?: string }) {
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
function att(fields: any, name: string): Att | undefined {
  const v = fields?.[name];
  return Array.isArray(v) && v[0]?.url ? { url: v[0].url as string, filename: v[0].filename as string | undefined } : undefined;
}

function DocButtons({ row }: { row: Row }) {
  const f = row as any;

  const ldv = att(f, 'Allegato LDV') || att(f, 'LDV') || att(f, 'Lettera di vettura') || att(f, 'AWB');
  const fatt = att(f, 'Allegato Fattura') || att(f, 'Fattura - Allegato Cliente') || att(f, 'Fattura');
  const pl = att(f, 'Allegato PL') || att(f, 'Packing List - Allegato Cliente') || att(f, 'Packing List');
  const dle = att(f, 'Allegato DLE');
  const extra = [att(f, 'Allegato 1'), att(f, 'Allegato 2'), att(f, 'Allegato 3')].filter(Boolean) as Att[];

  const Btn = ({ href, label }: { href: string; label: string }) => (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center rounded-md bg-[#1c3e5e] px-2.5 py-1 text-xs font-medium text-white hover:opacity-95"
    >
      {label}
    </a>
  );

  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {ldv && <Btn href={ldv.url} label="LDV" />}
      {fatt && <Btn href={fatt.url} label="Fattura" />}
      {pl && <Btn href={pl.url} label="Packing List" />}
      {dle && <Btn href={dle.url} label="DLE" />}
      {extra.map((e, i) => (
        <Btn key={`${e.url}-${i}`} href={e.url} label="Allegato" />
      ))}
    </div>
  );
}

function Card({ r, onDetails }: { r: Row; onDetails: () => void }) {
  const formato: string = r['Formato'] || '';
  const isPallet = /pallet/i.test(formato);
  const ref = r['ID Spedizione'] || r.human_id || r.id;

  const destRS = r['Destinatario - Ragione Sociale'] || r['Destinatario'] || r.dest_ragione_sociale || '';
  const destCitta = r['Destinatario - Città'] || r.dest_citta;
  const destPaese = r['Destinatario - Paese'] || r.dest_paese;
  const dest =
    destCitta || destPaese
      ? `${destCitta || ''}${destCitta && destPaese ? ' ' : ''}${destPaese ? ` (${destPaese})` : ''}`
      : '—';

  const stato = r['Stato'] || r.status || '—';

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

        <DocButtons row={r} />

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
  const [apiError, setApiError] = useState<string | null>(null);

  const [open, setOpen] = useState(false);
  const [sel, setSel] = useState<Row | null>(null);

  // Supabase client (solo lato client, anon)
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const supabase = useMemo(() => createClient(supabaseUrl, supabaseAnon), [supabaseUrl, supabaseAnon]);

  useEffect(() => {
    let alive = true;

    async function load() {
      setLoading(true);
      setApiError(null);

      try {
        // --- Auth: proviamo tutto
        let bearer: string | null = null;
        let email: string | null = null;

        // 1) Firebase ID token (se presente)
        try {
          const t = await getIdToken();
          if (t) {
            bearer = t;
            log('Auth via Firebase ID token presente');
          }
        } catch {
          // ignore
        }

        // 2) Supabase session
        if (!bearer || !email) {
          const { data, error: sErr } = await supabase.auth.getSession();
          if (!sErr && data?.session) {
            const at = data.session.access_token;
            const em = data.session.user?.email || null;
            if (at) {
              bearer = at;
              log('Auth via Supabase session OK (token)');
            }
            if (em) {
              email = em;
              log('Email da Supabase:', email);
              // salvo come fallback locale
              try {
                localStorage.setItem('userEmail', email);
              } catch {}
            }
          }
        }

        // 3) fallback localStorage
        if (!email) {
          try {
            const ls = localStorage.getItem('userEmail');
            if (ls) {
              email = ls;
              log('Email da localStorage:', email);
            }
          } catch {}
        }

        const params = new URLSearchParams();
        if (q.trim()) params.set('q', q.trim());
        if (sort) params.set('sort', sort);
        if (email) params.set('email', email);

        const headers: HeadersInit = {};
        if (bearer) headers['Authorization'] = `Bearer ${bearer}`;
        if (email) headers['x-user-email'] = email;

        log('→ GET /api/spedizioni', { query: params.toString(), headers });
        const res = await fetch(`/api/spedizioni?${params.toString()}`, {
          headers,
          cache: 'no-store',
        });

        const text = await res.text();
        let j: any = {};
        try {
          j = JSON.parse(text);
        } catch {
          j = { ok: false, parseError: true, raw: text };
        }
        log('← /api/spedizioni response', { status: res.status, ok: res.ok, body: j });

        if (!alive) return;

        if (res.ok && j?.ok) {
          const flat: Row[] = (j.rows || []).map((r: any) => ({
            id: r.human_id || r.id,
            _createdTime: r._createdTime ?? r.created_at ?? r.createdTime ?? r._rawJson?.createdTime ?? null,
            ...(r.fields || r),
          }));
          log('righe parse:', flat.length, flat);
          setRows(flat);
        } else {
          const msg = j?.error || j?.message || `HTTP ${res.status}`;
          setApiError(msg);
          setRows([]);
          warn('API non ok:', msg);
        }
      } catch (e: any) {
        error('load() exception', e);
        setApiError(String(e?.message || e));
        setRows([]);
      } finally {
        if (alive) setLoading(false);
      }
    }

    load();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, sort]); // ricarica quando cambiano filtro/ordinamento

  const filtered = useMemo(() => {
    const needle = norm(q);
    const arr = !needle
      ? rows
      : rows.filter(r => {
          const hay = [
            r['ID Spedizione'] || r.human_id,
            r['Destinatario - Ragione Sociale'] || r.dest_ragione_sociale,
            r['Destinatario - Città'] || r.dest_citta,
            r['Destinatario - Paese'] || r.dest_paese,
            r['Mittente - Ragione Sociale'] || r.mitt_ragione_sociale,
          ]
            .filter(Boolean)
            .map(norm)
            .join(' | ');
          return hay.includes(needle);
        });

    const copy = [...arr];
    copy.sort((a, b) => {
      if (sort === 'ritiro_desc') {
        const da = a['Ritiro - Data'] ? new Date(a['Ritiro - Data']).getTime() : (a.giorno_ritiro ? new Date(a.giorno_ritiro).getTime() : 0);
        const db = b['Ritiro - Data'] ? new Date(b['Ritiro - Data']).getTime() : (b.giorno_ritiro ? new Date(b.giorno_ritiro).getTime() : 0);
        return db - da;
      }
      if (sort === 'dest_az') {
        const aa = `${a['Destinatario - Città'] || a.dest_citta || ''} ${a['Destinatario - Paese'] || a.dest_paese || ''}`.toLowerCase();
        const bb = `${b['Destinatario - Città'] || b.dest_citta || ''} ${b['Destinatario - Paese'] || b.dest_paese || ''}`.toLowerCase();
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
        return order(a['Stato'] || a.status) - order(b['Stato'] || b.status);
      }
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

      {/* Messaggio errore API (se c'è) */}
      {apiError ? (
        <div className="mt-3 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
          Non riesco a caricare le spedizioni: <span className="font-mono">{apiError}</span>.  
          Controlla di essere loggato e che l’email dell’utente corrisponda a quella salvata nelle spedizioni.
        </div>
      ) : null}

      {/* Lista 1 card per riga */}
      {loading ? (
        <div className="text-sm text-slate-500 mt-3">Caricamento…</div>
      ) : filtered.length === 0 ? (
        <div className="text-sm text-slate-500 mt-3">Nessuna spedizione trovata.</div>
      ) : (
        <div className="mt-3 space-y-3">
          {filtered.map(r => (
            <Card key={r.id} r={r} onDetails={() => { setSel(r); setOpen(true); }} />
          ))}
        </div>
      )}

      {/* Drawer dettagli */}
      <Drawer open={open} onClose={() => setOpen(false)} title={sel ? (sel['ID Spedizione'] || sel.human_id || sel.id) : undefined}>
        {sel ? <ShipmentDetail f={(sel as any).fields ?? (sel as any)} /> : null}
      </Drawer>
    </>
  );
}
