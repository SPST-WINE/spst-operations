"use client";

import type { ShipmentDetailFlat } from "@/lib/backoffice/normalizeShipmentDetail";
import { formatDate, formatDateTime } from "@/components/backoffice/_parts/format";

export function HeaderSection({ shipment }: { shipment: ShipmentDetailFlat }) {
  const humanId = shipment.human_id || shipment.id;
  const emailCliente = shipment.email_cliente || shipment.email_norm || "—";

  return (
    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
      <div>
        <div className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
          SPST • Spedizioni clienti
        </div>
        <h1 className="mt-1 text-xl font-semibold text-slate-800">Spedizione {humanId}</h1>
        <p className="mt-1 text-sm text-slate-600">
          ID interno: <span className="font-mono text-xs text-slate-700">{shipment.id}</span>
        </p>
      </div>

      <div className="flex flex-col items-end gap-2 text-xs">
        <div className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-3 py-1 text-white">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-300" />
          <span className="font-medium">{shipment.status?.toUpperCase() || "DRAFT"}</span>
        </div>

        <div className="rounded-xl border bg-white px-3 py-2 text-right">
          <div className="text-[11px] text-slate-500">Tipo spedizione</div>
          <div className="text-xs font-medium text-slate-800">
            {shipment.tipo_spedizione || "—"} · {shipment.incoterm || "—"}
          </div>
          <div className="mt-1 text-[11px] text-slate-500">
            Creato il {formatDateTime(shipment.created_at)} • Ritiro{" "}
            {formatDate(shipment.giorno_ritiro)}
          </div>
          <div className="mt-1 text-[11px] text-slate-500">
            Cliente: <span className="font-medium text-slate-700">{emailCliente}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
