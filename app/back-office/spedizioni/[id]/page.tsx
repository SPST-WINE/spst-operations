// app/back-office/spedizioni/[id]/page.tsx

export const dynamic = "force-dynamic";

export default function BackofficeShipmentDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const { id } = params;

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-slate-800">
        Spedizione {id}
      </h1>

      <p className="text-sm text-slate-600 max-w-2xl">
        In questa pagina il back office potrà vedere tutti i dati di
        mittente, destinatario, spedizione, fatturazione e colli, allegare i
        documenti (LDV, fatture, packing list, DLE, allegati 1–4),
        impostare corriere e tracking e gestire l&apos;evasione.
      </p>

      <div className="rounded-2xl border bg-white p-4 text-sm text-slate-500">
        Placeholder dettagli spedizione.
        <br />
        Nel prossimo step colleghiamo i dati reali dal DB, la gestione
        documenti e le azioni di evasione.
      </div>

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          disabled
          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-600"
        >
          Invia mail &quot;spedizione evasa&quot;
        </button>
        <button
          type="button"
          disabled
          className="inline-flex items-center gap-1 rounded-lg bg-slate-900 px-3 py-1.5 text-xs text-white"
        >
          Evasione completata
        </button>
      </div>
    </div>
  );
}
