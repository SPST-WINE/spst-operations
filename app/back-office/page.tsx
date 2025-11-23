// app/back-office/page.tsx

export const dynamic = "force-dynamic";

export default function BackofficeHomePage() {
  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-slate-800">
        Riepilogo operativo
      </h1>

      <p className="text-sm text-slate-600 max-w-2xl">
        Qui il back office potrà gestire tutte le spedizioni, allegare documenti
        (LDV, fatture, packing list, DLE, allegati 1–4) e lavorare sulle
        quotazioni richieste dai clienti.
      </p>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border bg-white p-4 text-sm">
          <div className="text-xs font-semibold text-slate-500">
            Spedizioni
          </div>
          <div className="mt-1 text-base font-semibold text-slate-900">
            Elenco & dettagli
          </div>
          <p className="mt-2 text-xs text-slate-500">
            Vista completa di tutte le spedizioni SPST. Da collegare all’API{" "}
            <code className="rounded bg-slate-100 px-1 py-0.5 text-[10px]">
              /api/spedizioni
            </code>.
          </p>
        </div>

        <div className="rounded-2xl border bg-white p-4 text-sm">
          <div className="text-xs font-semibold text-slate-500">
            Documenti
          </div>
          <div className="mt-1 text-base font-semibold text-slate-900">
            Upload & gestione
          </div>
          <p className="mt-2 text-xs text-slate-500">
            Sezione per caricare LDV, fatture, packing list, DLE e allegati 1–4
            collegati alla spedizione.
          </p>
        </div>

        <div className="rounded-2xl border bg-white p-4 text-sm">
          <div className="text-xs font-semibold text-slate-500">
            Quotazioni
          </div>
          <div className="mt-1 text-base font-semibold text-slate-900">
            Richieste & preventivi
          </div>
          <p className="mt-2 text-xs text-slate-500">
            Vista delle richieste di quotazione e creazione interna dei
            preventivi per i clienti.
          </p>
        </div>
      </div>
    </div>
  );
}
