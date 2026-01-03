// app/carrier/waves/page.tsx
import CarrierWavesClient from "@/components/carrier/CarrierWavesClient";

export const dynamic = "force-dynamic";

export default function CarrierWavesPage() {
  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-slate-900">Le tue Waves</h1>
          <p className="text-sm text-slate-600">
            Vedi le waves assegnate al tuo trasportatore (RLS).
          </p>
        </div>
      </div>

      <CarrierWavesClient />
    </div>
  );
}
