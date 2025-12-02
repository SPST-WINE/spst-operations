// app/back-office/link-utili/page.tsx
export const dynamic = "force-dynamic";

import BackofficeLinkUtiliClient from "@/components/backoffice/BackofficeLinkUtiliClient";

export default function BackofficeLinkUtiliPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-slate-800">Link utili</h1>
      <p className="text-sm text-slate-600 max-w-2xl">
        File interni SPST, listini standard e tutorial operativi.
        Da qui puoi aprire i documenti, copiare rapidamente i link e
        gestire i riferimenti senza passare da Supabase.
      </p>

      <BackofficeLinkUtiliClient />
    </div>
  );
}
