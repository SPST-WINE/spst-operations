// app/usa-shipping-pay/page.tsx
export const dynamic = "force-dynamic";

import Image from "next/image";
import USAChargesCalculator from "@/components/usa/USAChargesCalculator";

const PAGE_GRADIENT =
  "radial-gradient(120% 120% at 50% -10%, #1c3e5e 0%, #0a1722 60%, #000 140%)";

type SearchParams = {
  wname?: string;
  wemail?: string;
};

function SimpleHeader() {
  return (
    <header className="w-full border-b border-white/10 bg-black/30 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center gap-3 px-5 py-3">
        <div className="relative h-8 w-8">
          <Image
            src="/spst-logo.png"
            alt="SPST logo"
            fill
            className="object-contain"
            priority
          />
        </div>
        <div className="flex flex-col">
          <span className="text-sm font-semibold tracking-tight">
            SPST – US Shipping & Duties
          </span>
          <span className="text-[11px] text-white/60">
            Link di pagamento per trasporto + dazi verso gli USA
          </span>
        </div>
      </div>
    </header>
  );
}

function SimpleFooter() {
  return (
    <footer className="mt-8 border-t border-white/10 bg-black/40">
      <div className="mx-auto flex max-w-5xl flex-col items-center gap-1 px-5 py-4 text-[11px] text-white/50">
        <span>SPST · Specialized Wine Shipping & Trade</span>
        <span>Powered by Stripe · Payments for US shipping & duties</span>
      </div>
    </footer>
  );
}

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
      <SimpleHeader />

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

      <SimpleFooter />
    </main>
  );
}
