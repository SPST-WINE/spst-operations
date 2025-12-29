"use client";

import type { ShipmentDetailFlat } from "@/lib/backoffice/normalizeShipmentDetail";
import { InfoRow } from "@/components/backoffice/_parts/ui/InfoRow";

export function PartiesSection({ shipment }: { shipment: ShipmentDetailFlat }) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <section className="space-y-3 rounded-2xl border bg-white p-4">
        <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Mittente
        </div>

        <div className="space-y-1">
          <div className="text-sm font-semibold text-slate-800">{shipment.mittente_rs || "—"}</div>
          <div className="text-xs text-slate-600">{shipment.mittente_indirizzo || "—"}</div>
        </div>

        <div className="mt-3 space-y-1.5">
          <InfoRow label="CAP" value={shipment.mittente_cap || undefined} />
          <InfoRow label="Città" value={shipment.mittente_citta || undefined} />
          <InfoRow label="Paese" value={shipment.mittente_paese || undefined} />
          <InfoRow label="Telefono" value={shipment.mittente_telefono || undefined} />
          <InfoRow label="Partita IVA" value={shipment.mittente_piva || undefined} />
        </div>
      </section>

      <section className="space-y-3 rounded-2xl border bg-white p-4">
        <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Destinatario
        </div>

        <div className="space-y-1">
          <div className="text-sm font-semibold text-slate-800">{shipment.dest_rs || "—"}</div>
          <div className="text-xs text-slate-600">{shipment.dest_indirizzo || "—"}</div>
        </div>

        <div className="mt-3 space-y-1.5">
          <InfoRow label="CAP" value={shipment.dest_cap || undefined} />
          <InfoRow label="Città" value={shipment.dest_citta || undefined} />
          <InfoRow label="Paese" value={shipment.dest_paese || undefined} />
          <InfoRow label="Telefono" value={shipment.dest_telefono || undefined} />
          <InfoRow label="Partita IVA / Tax ID" value={shipment.dest_piva || undefined} />
          <InfoRow
            label="Abilitato all'import"
            value={
              typeof shipment.dest_abilitato_import === "boolean"
                ? shipment.dest_abilitato_import
                  ? "Sì"
                  : "No"
                : undefined
            }
          />
        </div>
      </section>
    </div>
  );
}
