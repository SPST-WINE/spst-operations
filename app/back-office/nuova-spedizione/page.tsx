// app/back-office/nuova-spedizione/page.tsx
import BackofficeNuovaSpedizioneClient from "@/components/backoffice/BackofficeNuovaSpedizioneClient";

export const dynamic = "force-dynamic";

export default function BackofficeNuovaSpedizionePage() {
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-slate-800">
        Crea spedizione per un cliente
      </h1>
      <p className="text-sm text-slate-600 max-w-2xl">
        Da qui puoi creare una nuova spedizione per conto di qualsiasi cliente
        SPST, utilizzando gli stessi form dell&apos;area riservata ma legando
        tutto alla mail del cliente.
      </p>

      <BackofficeNuovaSpedizioneClient />
    </div>
  );
}
