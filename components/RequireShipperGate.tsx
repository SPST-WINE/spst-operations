// components/RequireShipperGate.tsx
"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";

export default function RequireShipperGate({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    let alive = true;

    async function run() {
      // ✅ Lasciamo sempre accesso a Impostazioni (dove completi il mittente)
      if (pathname === "/dashboard/impostazioni") return;

      try {
        const res = await fetch("/api/onboarding-status", { cache: "no-store" });
        const j = await res.json().catch(() => null);

        if (!alive) return;

        // Se endpoint non esiste o fallisce → non blocchiamo (fail-open)
        if (!res.ok || !j) return;

        // Se manca il mittente → redirect + messaggio
        if (j.ok && j.has_shipper === false) {
          router.replace("/dashboard/impostazioni?onboarding=1");
        }
      } catch {
        // fail-open
      }
    }

    run();
    return () => {
      alive = false;
    };
  }, [pathname, router]);

  return <>{children}</>;
}
