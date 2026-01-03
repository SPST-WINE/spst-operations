export const dynamic = "force-dynamic";

import BackofficePalletClient from "@/components/backoffice/BackofficePalletClient";

export default function BackofficePalletPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-slate-800">SPST Pallets</h1>
      <p className="text-sm text-slate-600 max-w-3xl">
        Sezione operativa per consolidare le spedizioni pallet che partono dalla
        Campania in <strong>WAVE</strong> (ritiri batch) da inoltrare ai
        trasportatori privati.
      </p>

      <BackofficePalletClient />
    </div>
  );
}
