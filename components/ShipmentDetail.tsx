"use client";

import type { ShipmentDTO } from "@/lib/contracts/shipment";

function L({ children }: { children: React.ReactNode }) {
  return <div className="text-[11px] font-medium text-slate-500">{children}</div>;
}
function V({ children }: { children: React.ReactNode }) {
  return <div className="text-[13px] text-slate-800">{children || "—"}</div>;
}

export default function ShipmentDetail({
  shipment,
}: {
  shipment: ShipmentDTO;
}) {
  const d = shipment;

  const mittAddr = [
    d.mittente?.indirizzo,
    d.mittente?.cap,
    d.mittente?.citta,
    d.mittente?.paese,
  ]
    .filter(Boolean)
    .join(", ");

  const destAddr = [
    d.destinatario?.cap,
    d.destinatario?.citta,
    d.destinatario?.paese,
  ]
    .filter(Boolean)
    .join(", ");

  const attachments = d.attachments || {};

  return (
    <div className="space-y-4">
      {/* ID */}
      <div>
        <L>ID Spedizione</L>
        <V>{d.human_id}</V>
      </div>

      {/* Mittente / Destinatario */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="rounded-lg border p-3">
          <L>Mittente</L>
          <V>{d.mittente?.rs}</V>
          <V>{mittAddr || "—"}</V>
          <V>Tel: {d.mittente?.telefono || "—"}</V>
          <div className="text-[11px] text-slate-500">
            P.IVA/CF: {d.mittente?.piva || "—"}
          </div>
        </div>

        <div className="rounded-lg border p-3">
          <L>Destinatario</L>
          <V>{d.destinatario?.rs}</V>
          <V>{destAddr || "—"}</V>
          <V>Tel: {d.destinatario?.telefono || "—"}</V>
          <div className="text-[11px] text-slate-500">
            P.IVA/CF: {d.destinatario?.piva || "—"}
          </div>
          <div className="text-[11px] text-slate-500">
            Abilitato import: {d.destinatario?.abilitato_import ? "Sì" : "No"}
          </div>
        </div>
      </div>

      {/* Meta */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="rounded-lg border p-3">
          <L>Data ritiro</L>
          <V>{d.giorno_ritiro}</V>
        </div>
        <div className="rounded-lg border p-3">
          <L>Incoterm</L>
          <V>{d.incoterm}</V>
        </div>
        <div className="rounded-lg border p-3">
          <L>Tipo spedizione</L>
          <V>{d.tipo_spedizione}</V>
        </div>
      </div>

      {/* Fatturazione */}
      <div className="rounded-lg border p-3">
        <L>Fatturazione</L>
        <V>{d.fatturazione?.rs || "—"}</V>
        <div className="text-[11px] text-slate-500">
          P.IVA/CF: {d.fatturazione?.piva || "—"}
        </div>
        <div className="text-[11px] text-slate-500">
          Valuta: {d.fatturazione?.valuta || "—"}
        </div>
      </div>

      {/* Colli */}
      <div className="rounded-lg border p-3">
        <L>Colli</L>
        {d.packages.length === 0 ? (
          <div className="text-[13px] text-slate-500">
            Nessun collo disponibile
          </div>
        ) : (
          <div className="mt-2 space-y-2">
            {d.packages.map((p, i) => (
              <div key={p.id} className="text-[13px]">
                <span className="font-medium">Collo {i + 1}:</span>{" "}
                {p.lato1_cm}×{p.lato2_cm}×{p.lato3_cm} cm — Peso:{" "}
                {p.peso_reale_kg} kg
                {p.contenuto ? <> — Contenuto: {p.contenuto}</> : null}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Allegati */}
      <div className="rounded-lg border p-3">
        <L>Allegati</L>
        <div className="mt-2 flex flex-col gap-1 text-xs">
          {[
            ["ldv", "Lettera di vettura (LDV)"],
            ["fattura_commerciale", "Fattura commerciale"],
            ["fattura_proforma", "Fattura proforma"],
            ["dle", "Documento DLE"],
            ["allegato1", "Allegato 1"],
            ["allegato2", "Allegato 2"],
            ["allegato3", "Allegato 3"],
            ["allegato4", "Allegato 4"],
          ].map(([k, label]) => {
            const att = (attachments as any)[k];
            return (
              <div
                key={k}
                className="flex items-center justify-between rounded-md border px-2.5 py-1.5"
              >
                <span className="text-slate-700">{label}</span>
                {att?.url ? (
                  <a
                    href={att.url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[11px] text-[#1c3e5e] underline"
                  >
                    Apri
                  </a>
                ) : (
                  <span className="text-[11px] text-slate-400">
                    Nessun file
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
