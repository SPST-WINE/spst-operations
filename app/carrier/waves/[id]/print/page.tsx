// app/carrier/waves/[id]/print/page.tsx
import CarrierWavePrintClient from "@/components/carrier/CarrierWavePrintClient";

export const dynamic = "force-dynamic";

export default function CarrierWavePrintPage({
  params,
}: {
  params: { id: string };
}) {
  return <CarrierWavePrintClient waveId={params.id} />;
}
