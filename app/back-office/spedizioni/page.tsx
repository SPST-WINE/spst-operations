// app/back-office/spedizioni/page.tsx

export const dynamic = "force-dynamic";

export default function BackofficeSpedizioniPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-slate-800">
        Spedizioni
      </h1>

      <p className="text-sm text-slate-600 max-w-2xl">
        Qui il back office potrà cercare, filtrare e aprire tutte le spedizioni
        (non solo quelle del singolo cliente), vedere i colli e gestire i
        documenti collegati.
      </p>

      <div className="rounded-2xl border bg-white p-4 text-sm text-slate-500">
        {/* Placeholder: in una fase successiva qui mettiamo la tabella */}
        Tabella spedizioni back office (da collegare all&apos;API{" "}
        <code className="rounded bg-slate-100 px-1 py-0.5 text-[11px]">
          GET /api/spedizioni
        </code>
        ) con ricerca per ID, cliente, mittente, destinatario, stato, ecc.
      </div>
    </div>
  );
}
