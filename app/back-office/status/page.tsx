import BackofficeStatusClient from "@/components/backoffice/BackofficeStatusClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function BackofficeStatusPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-slate-800">
        Update status spedizioni
      </h1>

      <p className="text-sm text-slate-600 max-w-2xl">
        Vista operativa per aggiornare rapidamente lo stato delle spedizioni.
        Usa la ricerca per trovare una spedizione e cambia lo status dal selettore.
      </p>

      <BackofficeStatusClient />
    </div>
  );
}
