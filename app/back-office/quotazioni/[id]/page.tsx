// app/back-office/quotazioni/[id]/page.tsx
import BackofficeQuoteDetailClient from "@/components/backoffice/BackofficeQuoteDetailClient";

export const dynamic = "force-dynamic";

type PageProps = {
  params: { id: string };
};

export default function BackofficeQuoteDetailPage({ params }: PageProps) {
  const { id } = params;

  return (
    <div className="space-y-4">
      <BackofficeQuoteDetailClient id={id} />
    </div>
  );
}
