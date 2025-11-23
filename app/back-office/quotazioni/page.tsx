// app/back-office/quotazioni/page.tsx

export const dynamic = "force-dynamic";

export default function BackofficeQuotazioniPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-slate-800">
        Quotazioni
      </h1>

      <p className="text-sm text-slate-600 max-w-2xl">
        Da qui il back office potrà vedere le richieste di quotazione,
        generare preventivi per i clienti e, quando confermati, trasformarli
        in spedizioni.
      </p>

      <div className="rounded-2xl border bg-white p-4 text-sm text-slate-500">
        {/* Placeholder: da collegare a /api/quotazioni */}
        Lista richieste di quotazione (Airtable / API{" "}
        <code className="rounded bg-slate-100 px-1 py-0.5 text-[11px]">
          /api/quotazioni
        </code>
        ) + azioni per creare, modificare e confermare i preventivi.
      </div>
    </div>
  );
}
