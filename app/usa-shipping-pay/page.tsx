// app/usa-shipping-pay/page.tsx
export const dynamic = "force-dynamic";

import SiteHeader from "@/components/layout/SiteHeader";
import SiteFooter from "@/components/layout/SiteFooter";
import USAChargesCalculator from "@/components/usa/USAChargesCalculator";

const PAGE_GRADIENT =
  "radial-gradient(120% 120% at 50% -10%, #1c3e5e 0%, #0a1722 60%, #000 140%)";

type SearchParams = {
  wname?: string;
  wemail?: string;
};

export default function USAShippingPayPage({
  searchParams,
}: {
  searchParams?: SearchParams;
}) {
  const initialWineryName = searchParams?.wname ?? "";
  const initialWineryEmail = searchParams?.wemail ?? "";

  return (
    <main
      className="min-h-screen text-white flex flex-col"
      style={{ background: PAGE_GRADIENT }}
    >
      <SiteHeader />

      <div className="flex-1">
        <div className="mx-auto w-full max-w-md px-5 py-8">
          <h1 className="text-2xl font-semibold tracking-tight mb-2">
            US Shipping & Duties
          </h1>
          <p className="text-sm text-white/70 mb-5">
            Genera un link di pagamento per il tuo cliente negli USA. Il totale
            include trasporto, dazi (15%) e commissioni Stripe.
          </p>

          <USAChargesCalculator
            initialWineryName={initialWineryName}
            initialWineryEmail={initialWineryEmail}
          />
        </div>
      </div>

      <SiteFooter />
    </main>
  );
}
