// app/back-office/spedizioni/page.tsx
import BackofficeSpedizioniClient from "@/components/backoffice/BackofficeSpedizioniClient";

export const dynamic = "force-dynamic";

export default function BackofficeSpedizioniPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-slate-800">
        Spedizioni clienti
      </h1>
      <BackofficeSpedizioniClient />
    </div>
  );
}
