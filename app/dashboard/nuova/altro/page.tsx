// FILE: app/dashboard/nuova/altro/page.tsx
"use client";

import { Suspense } from "react";
import NuovaAltroPageInner from "./NuovaAltroPageInner";

export default function NuovaAltroPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Nuova spedizione — altro</h2>
          <div className="text-sm text-slate-500">Caricamento…</div>
        </div>
      }
    >
      <NuovaAltroPageInner />
    </Suspense>
  );
}
