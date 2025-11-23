export const dynamic = "force-dynamic";

export default function BackofficeNuovaSpedizionePage() {
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-slate-800">
        Crea spedizione
      </h1>
      <p className="text-sm text-slate-600 max-w-2xl">
        Da qui l&apos;operativo può creare una nuova spedizione per conto dei
        clienti SPST, senza passare dall&apos;area riservata.
      </p>
      <div className="rounded-2xl border bg-white p-4 text-sm text-slate-500">
        Placeholder form &quot;Nuova spedizione back office&quot;.
        In seguito possiamo riutilizzare i componenti di
        <code className="ml-1 rounded bg-slate-100 px-1 py-0.5 text-[11px]">
          /dashboard/nuova
        </code>{" "}
        o creare un flusso dedicato.
      </div>
    </div>
  );
}
