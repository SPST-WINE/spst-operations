// FILE: app/dashboard/nuova/vino/_hooks/useAutoscrollErrors.ts
"use client";

import { useEffect } from "react";

export function useAutoscrollErrors(ref: React.RefObject<HTMLElement>, errorsLen: number) {
  useEffect(() => {
    if (errorsLen && ref.current) {
      ref.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [errorsLen, ref]);
}
