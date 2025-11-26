// app/dashboard/quotazioni/nuova/page.tsx
'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import PartyCard, { Party } from '@/components/nuova/PartyCard';
import ColliCard, { Collo } from '@/components/nuova/ColliCard';
import RitiroCard from '@/components/nuova/RitiroCard';

import { postPreventivo } from '@/lib/api';

const blankParty: Party = {
  ragioneSociale: '',
  referente: '',
  paese: '',
  citta: '',
  cap: '',
  indirizzo: '',
  telefono: '',
  piva: '',
};

export default function NuovaQuotazionePage() {
  const router = useRouter();
  const topRef = useRef<HTMLDivElement>(null);

  // email (per ora stub, stessa delle impostazioni)
  const [email, setEmail] = useState<string>('');

  // Parti
  const [mittente, setMittente] = useState<Party>(blankParty);
  const [destinatario, setDestinatario] = useState<Party>(blankParty);

  // Colli / dettagli merce
  const [colli, setColli] = useState<Collo[]>([
    { lunghezza_cm: null, larghezza_cm: null, altezza_cm: null, peso_kg: null },
  ]);
  const [formato, setFormato] = useState<'Pacco' | 'Pallet'>('Pacco');
  const [contenuto, setContenuto] = useState<string>('');

  // Dettagli spedizione
  const [valuta, setValuta] = useState<'EUR' | 'USD' | 'GBP'>('EUR');
  const [tipoSped, setTipoSped] = useState<'B2B' | 'B2C' | 'Sample'>('B2C');
  const [incoterm, setIncoterm] = useState<'DAP' | 'DDP' | 'EXW'>('DAP');

  // Ritiro
  const [ritiroData, setRitiroData] = useState<Date | undefined>(undefined);
  const [ritiroNote, setRitiroNote] = useState('');

  // Note generiche
  const [note, setNote] = useState('');

  // UI
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [ok, setOk] = useState<{ id: string; displayId?: string } | null>(null);

  // Prefill mittente dai dati di /api/impostazioni (stessa email di impostazioni)
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const emailNorm = 'info@spst.it';
        setEmail(emailNorm);

        const res = await fetch(
          `/api/impostazioni?email=${encodeURIComponent(emailNorm)}`,
          {
            method: 'GET',
            cache: 'no-store',
          }
        );

        const body = (await res.json().catch(() => null)) as
          | { ok?: boolean; email?: string; mittente?: any }
          | null;

        console.log(
          'SPST[quotazioni-nuova] GET /api/impostazioni response:',
          {
            status: res.status,
            body,
          }
        );

        if (!res.ok || !body?.ok || cancelled) return;

        // aggiorno mittente con i dati salvati nelle impostazioni
        if (body.mittente) {
          const m = body.mittente;
          setMittente(prev => ({
            ...prev,
            ragioneSociale: m.mittente ?? prev.ragioneSociale ?? '',
            paese: m.paese ?? prev.paese ?? '',
            citta: m.citta ?? prev.citta ?? '',
            cap: m.cap ?? prev.cap ?? '',
            indirizzo: m.indirizzo ?? prev.indirizzo ?? '',
            telefono: m.telefono ?? prev.telefono ?? '',
            piva: m.piva ?? prev.piva ?? '',
          }));
        }
      } catch (e) {
        console.error(
          'SPST[quotazioni-nuova] errore prefill impostazioni',
          e
        );
        // se fallisce, l’utente compila a mano il mittente
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  // Validazione minima per la quotazione
  function validate(): string[] {
    const errs: string[] = [];
    if (!mittente.ragioneSociale?.trim())
      errs.push('Inserisci la ragione sociale del mittente.');
    if (!destinatario.ragioneSociale?.trim())
      errs.push('Inserisci la ragione sociale del destinatario.');
    if (!ritiroData) errs.push('Seleziona il giorno di ritiro.');

    // Almeno un collo completo e valido
    const invalid = colli.some(
      c =>
        c.lunghezza_cm == null ||
        c.larghezza_cm == null ||
        c.altezza_cm == null ||
        c.peso_kg == null ||
        (c.lunghezza_cm ?? 0) <= 0 ||
        (c.larghezza_cm ?? 0) <= 0 ||
        (c.altezza_cm ?? 0) <= 0 ||
        (c.peso_kg ?? 0) <= 0
    );
    if (invalid) errs.push('Inserisci misure e pesi > 0 per ogni collo.');

    return errs;
  }

  async function salva() {
    if (saving) return;
    const v = validate();
    if (v.length) {
      setErrors(v);
      topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    } else {
      setErrors([]);
    }

    setSaving(true);
    try {
            const res = await postPreventivo({
        mittente: {
          ragioneSociale: mittente.ragioneSociale,
          paese: mittente.paese,
          citta: mittente.citta,
          cap: mittente.cap,
          indirizzo: mittente.indirizzo,
          telefono: mittente.telefono || undefined,
          taxId: mittente.piva || undefined,
        },
        destinatario: {
          ragioneSociale: destinatario.ragioneSociale,
          paese: destinatario.paese,
          citta: destinatario.citta,
          cap: destinatario.cap,
          indirizzo: destinatario.indirizzo,
          telefono: destinatario.telefono || undefined,
          taxId: destinatario.piva || undefined,
        },
        colli: (colli || []).map(c => ({
          quantita: 1,
          lunghezza_cm: c.lunghezza_cm ?? null,
          larghezza_cm: c.larghezza_cm ?? null,
          altezza_cm: c.altezza_cm ?? null,
          peso_kg: c.peso_kg ?? null,
        })),
        valuta, // 'EUR' | 'USD' | 'GBP'
        noteGeneriche: note,
        ritiroData: ritiroData ? ritiroData.toISOString() : undefined,
        tipoSped, // 'B2B' | 'B2C' | 'Sample'
        incoterm, // 'DAP' | 'DDP' | 'EXW'
        // 👇 nuovo campo: prendiamo lo state `contenuto`
        contenutoColli: contenuto || undefined,
        createdByEmail: email || undefined,
        // customerEmail lo potremo gestire in futuro se aggiungi un campo email cliente
      });


      setOk({ id: res?.id, displayId: res?.displayId });
      topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch (e) {
      console.error('Errore creazione preventivo', e);
      setErrors(['Errore durante la creazione della quotazione. Riprova.']);
    } finally {
      setSaving(false);
    }
  }

  // Success UI
  if (ok?.id) {
    return (
      <div ref={topRef} className="space-y-4">
        <h2 className="text-lg font-semibold">Quotazione inviata</h2>
        <div className="rounded-2xl border bg-white p-4">
          <p className="text-sm">
            ID preventivo:{' '}
            <span className="font-mono">{ok.displayId || ok.id}</span>
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link
              href="/dashboard/quotazioni"
              className="rounded-lg border bg-white px-4 py-2 text-sm hover:bg-slate-50"
            >
              Le mie quotazioni
            </Link>
            <button
              onClick={() => router.refresh()}
              className="rounded-lg border bg-white px-4 py-2 text-sm hover:bg-slate-50"
            >
              Nuova quotazione
            </button>
          </div>
        </div>
      </div>
    );
  }

  // FORM
  return (
    <div ref={topRef} className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-slate-800">
          Nuova quotazione
        </h1>
        <Link
          href="/dashboard/quotazioni"
          className="rounded-lg border bg-white px-4 py-2 text-sm hover:bg-slate-50"
        >
          Le mie quotazioni
        </Link>
      </div>

      {!!errors.length && (
        <div className="rounded-xl border border-rose-300 bg-rose-50 p-3 text-sm text-rose-800">
          <div className="mb-1 font-medium">Controlla questi campi:</div>
          <ul className="ml-5 list-disc space-y-1">
            {errors.map((e, i) => (
              <li key={i}>{e}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Mittente / Destinatario */}
      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border bg-white p-4">
          <h2 className="mb-3 text-base font-semibold text-spst-blue">
            Mittente
          </h2>
          <PartyCard value={mittente} onChange={setMittente} title="" />
        </div>
        <div className="rounded-2xl border bg-white p-4">
          <h2 className="mb-3 text-base font-semibold text-spst-blue">
            Destinatario
          </h2>
          <PartyCard value={destinatario} onChange={setDestinatario} title="" />
        </div>
      </div>

      {/* Colli / contenuto */}
      <div className="space-y-4">
        <div className="rounded-2xl border bg-white p-4">
          <h2 className="mb-3 text-base font-semibold text-spst-blue">
            Colli
          </h2>
          <ColliCard
            colli={colli}
            onChange={setColli}
            formato={formato}
            setFormato={setFormato}
            contenuto={contenuto}
            setContenuto={setContenuto}
          />
        </div>

        <div className="rounded-2xl border bg-white p-4">
          <h2 className="mb-3 text-base font-semibold text-spst-blue">
            Dettagli spedizione
          </h2>

          <div className="space-y-3 text-sm">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">
                  Valuta
                </label>
                <select
                  className="w-full rounded-lg border px-3 py-2 text-sm"
                  value={valuta}
                  onChange={e =>
                    setValuta(e.target.value as 'EUR' | 'USD' | 'GBP')
                  }
                >
                  <option value="EUR">EUR</option>
                  <option value="USD">USD</option>
                  <option value="GBP">GBP</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">
                  Formato
                </label>
                <select
                  className="w-full rounded-lg border px-3 py-2 text-sm"
                  value={formato}
                  onChange={e =>
                    setFormato(e.target.value as 'Pacco' | 'Pallet')
                  }
                >
                  <option value="Pacco">Pacco</option>
                  <option value="Pallet">Pallet</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">
                  Tipo spedizione
                </label>
                <select
                  className="w-full rounded-lg border px-3 py-2 text-sm"
                  value={tipoSped}
                  onChange={e =>
                    setTipoSped(e.target.value as 'B2B' | 'B2C' | 'Sample')
                  }
                >
                  <option value="B2B">B2B</option>
                  <option value="B2C">B2C</option>
                  <option value="Sample">Campionatura</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">
                  Incoterm
                </label>
                <select
                  className="w-full rounded-lg border px-3 py-2 text-sm"
                  value={incoterm}
                  onChange={e =>
                    setIncoterm(e.target.value as 'DAP' | 'DDP' | 'EXW')
                  }
                >
                  <option value="DAP">DAP</option>
                  <option value="DDP">DDP</option>
                  <option value="EXW">EXW</option>
                </select>
              </div>
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">
                Contenuto merce
              </label>
              <textarea
                className="min-h-[60px] w-full rounded-lg border px-3 py-2 text-sm"
                value={contenuto}
                onChange={e => setContenuto(e.target.value)}
                placeholder="Descrizione sintetica della merce…"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Ritiro + note */}
      <div className="space-y-4">
        <div className="rounded-2xl border bg-white p-4">
          <h2 className="mb-3 text-base font-semibold text-spst-blue">
            Ritiro
          </h2>
          <RitiroCard
            date={ritiroData}
            setDate={setRitiroData}
            note={ritiroNote}
            setNote={setRitiroNote}
          />
        </div>

        <div className="rounded-2xl border bg-white p-4">
          <h2 className="mb-3 text-base font-semibold text-spst-blue">
            Note generiche
          </h2>
          <textarea
            className="min-h-[120px] w-full rounded-lg border px-3 py-2 text-sm"
            value={note}
            onChange={e => setNote(e.target.value)}
            placeholder="Aggiungi eventuali note sulla spedizione…"
          />
        </div>
      </div>

      {/* CTA */}
      <div className="flex justify-end">
        <button
          type="button"
          onClick={salva}
          disabled={saving}
          aria-busy={saving}
          className="inline-flex items-center gap-2 rounded-lg border bg-white px-4 py-2 text-sm hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saving && (
            <span className="inline-block h-4 w-4 animate-spin rounded-full border border-slate-400 border-t-transparent" />
          )}
          {saving ? 'Invio…' : 'Invia richiesta'}
        </button>
      </div>
    </div>
  );
}
