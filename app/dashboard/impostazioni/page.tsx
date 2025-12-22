// app/dashboard/impostazioni/page.tsx
import { Suspense } from "react";
import ImpostazioniClient from "./ImpostazioniClient";

export const dynamic = "force-dynamic";

export default function Page() {
  return (
    <Suspense fallback={<div className="text-sm text-slate-500">Caricamento…</div>}>
      <ImpostazioniClient />
    </Suspense>
  );
}
