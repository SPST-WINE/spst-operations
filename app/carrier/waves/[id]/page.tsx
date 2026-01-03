// app/carrier/waves/[id]/page.tsx
import CarrierWaveDetailClient from "@/components/carrier/CarrierWaveDetailClient";

export const dynamic = "force-dynamic";

export default function CarrierWaveDetailPage({
  params,
}: {
  params: { id: string };
}) {
  return <CarrierWaveDetailClient waveId={params.id} />;
}
