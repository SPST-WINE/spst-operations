import BackofficePalletWaveDetailClient from "@/components/backoffice/BackofficePalletWaveDetailClient";

export const dynamic = "force-dynamic";

export default function BackofficePalletWaveDetailPage({
  params,
}: {
  params: { id: string };
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-baseline justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-800">Dettaglio WAVE</h1>
          <p className="text-sm text-slate-600 max-w-3xl">
            Vista operativa della wave: elenco ritiri, DDT, dati mittente/destinatario.
          </p>
        </div>
      </div>

      <BackofficePalletWaveDetailClient waveId={params.id} />
    </div>
  );
}
