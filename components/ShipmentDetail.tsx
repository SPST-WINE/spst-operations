"use client";

import type { ReactNode } from "react";
import type { ShipmentDTO } from "@/lib/contracts/shipment";
import { buildTrackingUrl } from "@/lib/tracking-links";
import { ExternalLink } from "lucide-react";

function L({ children }: { children?: ReactNode }) {
  return <div className="text-[11px] font-medium text-slate-500">{children}</div>;
}
function V({ children }: { children?: ReactNode }) {
  return <div className="text-[13px] text-slate-800">{children || "—"}</div>;
}

function StatusBadge({ value }: { value?: string | null }) {
  const raw = (value || "").trim();

  // normalizzo: maiuscolo, spazi "puliti"
  const v = raw
    .toUpperCase()
    .replace(/\s+/g, " ")
    .trim();

  const map: Record<string, { cls: string; label: string }> = {
    CREATA: {
      cls: "bg-slate-50 text-slate-700 ring-slate-200",
      label: "CREATA",
    },
    "IN RITIRO": {
      cls: "bg-amber-50 text-amber-800 ring-amber-200",
      label: "IN RITIRO",
    },
    "IN TRANSITO": {
      cls: "bg-sky-50 text-sky-800 ring-sky-200",
      label: "IN TRANSITO",
    },
    CONSEGNATA: {
      cls: "bg-emerald-50 text-emerald-800 ring-emerald-200",
      label: "CONSEGNATA",
    },
    ECCEZIONE: {
      cls: "bg-rose-50 text-rose-800 ring-rose-200",
      label: "ECCEZIONE",
    },
    ANNULLATA: {
      cls: "bg-zinc-50 text-zinc-700 ring-zinc-200",
      label: "ANNULLATA",
    },
  };

  // fallback: se arriva roba legacy (tipo "in consegna", "failed", ecc.)
  let cls = "bg-slate-50 text-slate-700 ring-slate-200";
  let text = raw || "—";

  if (map[v]) {
    cls = map[v].cls;
    text = map[v].label;
  } else {
    const low = raw.toLowerCase();
    if (low.includes("transit")) cls = "bg-sky-50 text-sky-800 ring-sky-200";
    else if (low.includes("consegn")) cls = "bg-emerald-50 text-emerald-800 ring-emerald-200";
    else if (low.includes("ritiro")) cls = "bg-amber-50 text-amber-800 ring-amber-200";
    else if (low.includes("eccez") || low.includes("failed"))
      cls = "bg-rose-50 text-rose-800 ring-rose-200";
    else if (low.includes("annull")) cls = "bg-zinc-50 text-zinc-700 ring-zinc-200";
  }

  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs ring-1 ${cls}`}
    >
      {text}
    </span>
  );
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

  // Tracking URL
  const trackingUrl = buildTrackingUrl(d.carrier, d.tracking_code);

  return (
    <div className="space-y-4">
      {/* ID + Status */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <L>ID Spedizione</L>
          <V>{d.human_id}</V>
        </div>
        <div className="pt-5">
          <StatusBadge value={d.status} />
        </div>
      </div>

      {/* Corriere e Tracking */}
      {(d.carrier || d.tracking_code) && (
        <div className="rounded-lg border p-3">
          <L>Corriere e Tracking</L>
          <div className="mt-2 space-y-2">
            {d.carrier && (
              <div className="text-[13px] text-slate-800">
                <span className="font-medium">Corriere:</span> {d.carrier}
              </div>
            )}
            {d.tracking_code && (
              <div className="text-[13px] text-slate-800">
                <span className="font-medium">Codice tracking:</span> {d.tracking_code}
              </div>
            )}
            {trackingUrl && (
              <div className="pt-1">
                <a
                  href={trackingUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-md bg-[#1c3e5e] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#1a3650] transition-colors"
                >
                  Vai al tracking
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            )}
          </div>
        </div>
      )}

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
  Valuta: {d.fatt_valuta || "—"}
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
