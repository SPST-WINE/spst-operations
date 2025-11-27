// app/back-office/utility-documenti/page.tsx
import BackofficeUtilityDocumentiClient from "@/components/backoffice/BackofficeUtilityDocumentiClient";

export const dynamic = "force-dynamic";

export default function BackofficeUtilityDocumentiPage() {
  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <p className="text-xs uppercase tracking-wide text-slate-500">
          SPST · Back Office
        </p>
        <h1 className="text-xl font-semibold text-slate-900">
          Utility documenti
        </h1>
        <p className="text-sm text-slate-500">
          Genera DDT, fatture e dichiarazioni di libera esportazione partendo
          dai dati di una spedizione esistente.
        </p>
      </header>

      <BackofficeUtilityDocumentiClient />
    </div>
  );
}
