// FILE: app/dashboard/nuova/vino/page.tsx
"use client";

import { Suspense } from "react";
import NuovaVinoPageInner from "./NuovaVinoPageInner";

export default function NuovaVinoPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Nuova spedizione — vino</h2>
          <div className="text-sm text-slate-500">Caricamento…</div>
        </div>
      }
    >
      <NuovaVinoPageInner />
    </Suspense>
  );
}
