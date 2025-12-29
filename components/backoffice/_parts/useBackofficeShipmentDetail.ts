"use client";

import { useCallback, useEffect, useState } from "react";
import type { ShipmentDetailFlat } from "@/lib/backoffice/normalizeShipmentDetail";
import { normalizeShipmentDTOToFlat } from "@/lib/backoffice/normalizeShipmentDetail";

type ShipmentDetail = ShipmentDetailFlat;

export function useBackofficeShipmentDetail(id: string) {
  const [data, setData] = useState<ShipmentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/spedizioni/${id}`, { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const json = await res.json();
      if (json?.ok && json.shipment) {
        const s = normalizeShipmentDTOToFlat(json.shipment);
        setData(s as ShipmentDetail);
      } else {
        throw new Error("Risposta API non valida");
      }
    } catch (e) {
      console.error("[BackofficeShipmentDetail] load error:", e);
      setError("Impossibile caricare i dati della spedizione.");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    let active = true;
    (async () => {
      if (!active) return;
      await load();
    })();
    return () => {
      active = false;
    };
  }, [load]);

  return { data, loading, error, reload: load };
}
