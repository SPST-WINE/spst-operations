// app/quote/[token]/page.tsx
import QuotePublicClient from "@/components/public/QuotePublicClient";

export const dynamic = "force-dynamic";

type PageProps = {
  params: { token: string };
};

export default function QuotePublicPage({ params }: PageProps) {
  const { token } = params;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50">
      <QuotePublicClient token={token} />
    </div>
  );
}
