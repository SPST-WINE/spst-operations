"use client";

import type { ShipmentDetailFlat } from "@/lib/backoffice/normalizeShipmentDetail";

const toNum = (v: any): number | null => {
  if (v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

export function PackingListSection({ shipment }: { shipment: ShipmentDetailFlat }) {
  const fieldsAny: any = (shipment as any).fields || {};
  const rawPL = fieldsAny.packing_list || fieldsAny.packingList || fieldsAny.pl || null;

  const plRows: any[] = Array.isArray(rawPL?.rows) ? rawPL.rows : Array.isArray(rawPL) ? rawPL : [];
  const plNote: string | null = (rawPL && (rawPL.note || rawPL.notes || null)) || null;

  const plTotals = { totalItems: 0, totalQty: 0, totalNetKg: 0, totalGrossKg: 0 };

  plRows.forEach((r: any) => {
    const qtyRaw = r.qta ?? r.quantita ?? r.qty ?? r.quantity ?? r.num ?? r.numero ?? r.bottiglie ?? 0;
    const qty = Number(qtyRaw) || 0;

    const netRaw =
      r.net_kg ??
      r.peso_netto ??
      r.netWeight ??
      r.net_weight ??
      (r.peso_netto_bott != null ? qty * Number(r.peso_netto_bott) : 0);

    const grossRaw =
      r.gross_kg ??
      r.peso_lordo ??
      r.grossWeight ??
      r.gross_weight ??
      (r.peso_lordo_bott != null ? qty * Number(r.peso_lordo_bott) : 0);

    plTotals.totalItems += 1;
    plTotals.totalQty += qty;
    plTotals.totalNetKg += Number(netRaw) || 0;
    plTotals.totalGrossKg += Number(grossRaw) || 0;
  });

  return (
    <section className="space-y-3 rounded-2xl border bg-white p-4">
      <div className="flex items-center justify-between gap-2">
        <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Packing list</div>
        {plRows.length > 0 && (
          <div className="text-[11px] text-slate-500">
            {plTotals.totalItems} righe • Q.tà tot: {plTotals.totalQty || "—"} • Netto:{" "}
            {plTotals.totalNetKg.toFixed(2)} kg • Lordo: {plTotals.totalGrossKg.toFixed(2)} kg
          </div>
        )}
      </div>

      {plRows.length === 0 ? (
        <>
          <p className="text-[11px] text-slate-500">
            Nessuna packing list strutturata trovata nei dati della spedizione.
          </p>
          {fieldsAny && (
            <details className="mt-2 rounded-lg border border-dashed border-slate-200 bg-slate-50 px-3 py-2 text-[11px] text-slate-500">
              <summary className="cursor-pointer font-medium">Debug dati raw (fields)</summary>
              <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap text-[10px]">
                {JSON.stringify(fieldsAny, null, 2)}
              </pre>
            </details>
          )}
        </>
      ) : (
        <>
          <div className="overflow-hidden rounded-xl border border-slate-100">
            <table className="min-w-full border-collapse text-xs">
              <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-3 py-2 text-left">#</th>
                  <th className="px-3 py-2 text-left">Etichetta</th>
                  <th className="px-3 py-2 text-left">Tipologia</th>
                  <th className="px-3 py-2 text-left">Q.tà</th>
                  <th className="px-3 py-2 text-left">Formato (L)</th>
                  <th className="px-3 py-2 text-left">Gradazione</th>
                  <th className="px-3 py-2 text-left">Prezzo</th>
                  <th className="px-3 py-2 text-left">Valuta</th>
                  <th className="px-3 py-2 text-left">Peso netto (kg)</th>
                  <th className="px-3 py-2 text-left">Peso lordo (kg)</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {plRows.map((r: any, idx: number) => {
                  const qty = toNum(
                    r.bottiglie ?? r.qta ?? r.quantita ?? r.qty ?? r.quantity ?? r.num ?? r.numero ?? null
                  );

                  const formato = toNum(r.formato_litri);
                  const grad = toNum(r.gradazione);
                  const prezzo = toNum(r.prezzo);
                  const valuta = r.valuta || "EUR";

                  const pesoNetto = toNum(
                    r.peso_netto_bott ?? r.peso_netto ?? r.net_kg ?? r.netWeight ?? r.net_weight
                  );

                  const pesoLordo = toNum(
                    r.peso_lordo_bott ?? r.peso_lordo ?? r.gross_kg ?? r.grossWeight ?? r.gross_weight
                  );

                  return (
                    <tr key={r.id || idx} className="hover:bg-slate-50/70">
                      <td className="px-3 py-2 align-middle text-slate-700">{idx + 1}</td>
                      <td className="px-3 py-2 align-middle text-slate-700">
                        {r.etichetta ||
                          r.description ||
                          r.descrizione ||
                          r.nome ||
                          r.label ||
                          r.prodotto ||
                          `Riga ${idx + 1}`}
                      </td>
                      <td className="px-3 py-2 align-middle text-slate-700 capitalize">
                        {r.tipologia || "—"}
                      </td>
                      <td className="px-3 py-2 align-middle text-slate-700">{qty ?? "—"}</td>
                      <td className="px-3 py-2 align-middle text-slate-700">
                        {formato != null ? formato.toFixed(2) : "—"}
                      </td>
                      <td className="px-3 py-2 align-middle text-slate-700">
                        {grad != null ? `${grad}%` : "—"}
                      </td>
                      <td className="px-3 py-2 align-middle text-slate-700">
                        {prezzo != null ? prezzo.toFixed(2) : "—"}
                      </td>
                      <td className="px-3 py-2 align-middle text-slate-700">{valuta}</td>
                      <td className="px-3 py-2 align-middle text-slate-700">
                        {pesoNetto != null ? pesoNetto.toFixed(2) : "—"}
                      </td>
                      <td className="px-3 py-2 align-middle text-slate-700">
                        {pesoLordo != null ? pesoLordo.toFixed(2) : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>

              <tfoot className="bg-slate-50 text-[11px] text-slate-600">
                <tr>
                  <td className="px-3 py-2 font-semibold" colSpan={3}>
                    Totali
                  </td>
                  <td className="px-3 py-2 font-semibold">{plTotals.totalQty || "—"}</td>
                  <td className="px-3 py-2" />
                  <td className="px-3 py-2" />
                  <td className="px-3 py-2" />
                  <td className="px-3 py-2" />
                  <td className="px-3 py-2 font-semibold">{plTotals.totalNetKg.toFixed(2)} kg</td>
                  <td className="px-3 py-2 font-semibold">{plTotals.totalGrossKg.toFixed(2)} kg</td>
                </tr>
              </tfoot>
            </table>
          </div>

          {plNote && <p className="mt-2 text-[11px] text-slate-500">Note: {plNote}</p>}
        </>
      )}
    </section>
  );
}
