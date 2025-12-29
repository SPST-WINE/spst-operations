"use client";

import type { ShipmentDetailFlat } from "@/lib/backoffice/normalizeShipmentDetail";

export function PackagesSection({ shipment }: { shipment: ShipmentDetailFlat }) {
  const pkgs = shipment.packages || [];

  return (
    <section className="space-y-3 rounded-2xl border bg-white p-4">
      <div className="flex items-center justify-between">
        <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Colli</div>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-100">
        <table className="min-w-full border-collapse text-xs">
          <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-3 py-2 text-left">#</th>
              <th className="px-3 py-2 text-left">Dimensioni (cm)</th>
              <th className="px-3 py-2 text-left">Peso (kg)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {!pkgs.length ? (
              <tr>
                <td colSpan={3} className="px-3 py-4 text-center text-slate-400">
                  Nessun collo registrato.
                </td>
              </tr>
            ) : (
              pkgs.map((p, idx) => (
                <tr key={p.id || idx} className="hover:bg-slate-50/70">
                  <td className="px-3 py-2 align-middle text-slate-700">{idx + 1}</td>
                  <td className="px-3 py-2 align-middle text-slate-700">
                    {[p.l1, p.l2, p.l3]
                      .map((v) => (typeof v === "number" ? `${v.toFixed(0)}` : "—"))
                      .join(" × ")}
                  </td>
                  <td className="px-3 py-2 align-middle text-slate-700">
                    {typeof p.weight_kg === "number" ? `${p.weight_kg.toFixed(2)}` : "—"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
