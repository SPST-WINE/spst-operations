// app/back-office/spedizioni/page.tsx
import BackofficeSpedizioniClient from "@/components/backoffice/BackofficeSpedizioniClient";

export const dynamic = "force-dynamic";

export default function BackofficeSpedizioniPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-slate-800">
        Spedizioni clienti
      </h1>

      <p className="text-sm text-slate-600 max-w-2xl">
        Vista operativa di tutte le spedizioni create dai clienti SPST, con
        dati di mittente, destinatario, colli, tipo di spedizione e incoterm.
        Da qui puoi aprire il dettaglio completo di ogni spedizione.
      </p>

      <BackofficeSpedizioniClient />
    </div>
  );
}
