export const dynamic = "force-dynamic";

export default function BackofficeEdasPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-slate-800">e-DAS</h1>
      <p className="text-sm text-slate-600 max-w-2xl">
        Qui potremo gestire la parte operativa degli e-DAS collegati alle spedizioni:
        numerazione, stato, allegati e note interne.
      </p>
      <div className="rounded-2xl border bg-white p-4 text-sm text-slate-500">
        Placeholder sezione e-DAS (tabella + dettaglio).
      </div>
    </div>
  );
}
