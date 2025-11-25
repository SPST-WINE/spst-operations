// app/back-office/quotazioni/page.tsx
import BackofficeQuotazioniClient from "@/components/backoffice/BackofficeQuotazioniClient";

export const dynamic = "force-dynamic";

export default function BackofficeQuotazioniPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-slate-800">
        Quotazioni
      </h1>

      <p className="text-sm text-slate-600 max-w-2xl">
        Da qui il back office può vedere le richieste di quotazione inviate
        dai clienti, creare una o più opzioni di preventivo, inviare il link
        pubblico al cliente e monitorare lo stato (inviata / accettata / rifiutata).
      </p>

      <BackofficeQuotazioniClient />
    </div>
  );
}
