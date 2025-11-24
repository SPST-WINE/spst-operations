// app/back-office/spedizioni/[id]/page.tsx
import BackofficeShipmentDetailClient from "@/components/backoffice/BackofficeShipmentDetailClient";

export const dynamic = "force-dynamic";

export default function BackofficeShipmentDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const { id } = params;

  return (
    <div className="space-y-4">
      <BackofficeShipmentDetailClient id={id} />
    </div>
  );
}
