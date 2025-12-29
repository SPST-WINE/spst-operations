"use client";

import { Package } from "lucide-react";
import type { ShipmentDetailFlat } from "@/lib/backoffice/normalizeShipmentDetail";
import { InfoRow } from "@/components/backoffice/_parts/ui/InfoRow";
import { formatWeightKg } from "@/components/backoffice/_parts/format";

export function ShipmentAndBillingSection({
  shipment,
  pkgSummary,
}: {
  shipment: ShipmentDetailFlat;
  pkgSummary: string;
}) {
  const insuredValue = typeof shipment.declared_value === "number" ? shipment.declared_value : null;

  return (
    <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
      <section className="space-y-3 rounded-2xl border bg-white p-4">
        <div className="flex items-center justify-between">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Dettagli spedizione
          </div>
          <div className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-700">
            <Package className="h-3 w-3" />
            {pkgSummary}
          </div>
        </div>

        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          <InfoRow
            label="Numero colli"
            value={typeof shipment.colli_n === "number" ? String(shipment.colli_n) : undefined}
          />
          <InfoRow label="Peso reale" value={formatWeightKg(shipment.peso_reale_kg)} />
          <InfoRow label="Formato spedizione" value={shipment.formato_sped || undefined} />
          <InfoRow label="Contenuto" value={shipment.contenuto_generale || undefined} />
          <InfoRow
            label="Valore assicurato"
            value={
              insuredValue != null
                ? `${insuredValue.toFixed(2)} ${shipment.fatt_valuta || "EUR"}`
                : "—"
            }
          />
          <InfoRow label="Note ritiro" value={shipment.note_ritiro || undefined} />
        </div>
      </section>

      <section className="space-y-3 rounded-2xl border bg-white p-4">
        <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Fatturazione
        </div>

        <div className="space-y-1">
          <div className="text-sm font-semibold text-slate-800">{shipment.fatt_rs || "—"}</div>
          <div className="text-xs text-slate-600">{shipment.fatt_indirizzo || "—"}</div>
        </div>

        <div className="mt-3 space-y-1.5">
          <InfoRow label="CAP" value={shipment.fatt_cap || undefined} />
          <InfoRow label="Città" value={shipment.fatt_citta || undefined} />
          <InfoRow label="Paese" value={shipment.fatt_paese || undefined} />
          <InfoRow label="Telefono" value={shipment.fatt_telefono || undefined} />
          <InfoRow label="P.IVA / Tax ID fattura" value={shipment.fatt_piva || undefined} />
          <InfoRow label="Valuta" value={shipment.fatt_valuta || undefined} />
        </div>
      </section>
    </div>
  );
}
