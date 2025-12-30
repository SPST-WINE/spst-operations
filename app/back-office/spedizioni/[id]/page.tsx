// app/back-office/spedizioni/[id]/page.tsx
import BackofficeShipmentDetailClient from "@/components/backoffice/BackofficeShipmentDetailClient";

export const dynamic = "force-dynamic";

// ---------------------------------------------
// DYNAMIC PAGE TITLE (fine tuning browser title)
// ---------------------------------------------
export async function generateMetadata({
  params,
}: {
  params: { id: string };
}) {
  const { id } = params;

  try {
    // Chiamiamo la tua API interna
    const base = process.env.NEXT_PUBLIC_BASE_URL;

    const res = await fetch(`${base}/api/backoffice/shipments/${id}`, {
    cache: "no-store",
  });

    if (!res.ok) {
      return {
        title: `Spedizione ${id}`,
      };
    }

    const json = await res.json();
    const shipment = json?.shipment;

    // ID umano se disponibile
    const human = shipment?.human_id;

    if (human) {
      return {
        title: `${human}`,
      };
    }

    // fallback
    return {
      title: `SPST • Spedizione ${id}`,
    };
  } catch (e) {
    return {
      title: `SPST • Spedizione ${id}`,
    };
  }
}

// ---------------------------------------------
// PAGE RENDERING
// ---------------------------------------------
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
