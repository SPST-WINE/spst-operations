// components/ShipmentDetail.tsx
"use client";

import { useEffect, useState } from "react";

type Pkg = {
  id?: string;
  l1: number | null;
  l2: number | null;
  l3: number | null;
  weight_kg: number | null;
  contenuto?: string | null;
};

type AttachmentInfo =
  | {
      url: string;
      file_name?: string | null;
      mime_type?: string | null;
      size?: number | null;
    }
  | null;

type ShipRow = {
  id: string;
  human_id?: string | null;
  created_it?: string | null;

  // principali
  tipo_spedizione?: string | null;
  incoterm?: string | null;
  giorno_ritiro?: string | null;
  status?: string | null;

  // mittente
  mittente_rs?: string | null;
  mittente_paese?: string | null;
  mittente_citta?: string | null;
  mittente_cap?: string | null;
  mittente_indirizzo?: string | null;
  mittente_telefono?: string | null;
  mittente_piva?: string | null;

  // destinatario
  dest_rs?: string | null;
  dest_paese?: string | null;
  dest_citta?: string | null;
  dest_cap?: string | null;
  dest_telefono?: string | null;
  dest_piva?: string | null;
  dest_abilitato_import?: boolean | null;

  // fatturazione
  fatt_rs?: string | null;
  fatt_piva?: string | null;
  fatt_valuta?: string | null;

  // colli / payload
  colli_n?: number | null;
  peso_reale_kg?: string | number | null;
  formato_sped?: string | null;
  contenuto_generale?: string | null;

  // colli lato server
  packages?: Pkg[];
  packages_count?: number;

  // blob originale
  fields?: any;
};

type ShipDetail = ShipRow & {
  attachments?: {
    ldv?: AttachmentInfo;
    fattura_proforma?: AttachmentInfo;
    fattura_commerciale?: AttachmentInfo;
    dle?: AttachmentInfo;
    allegato1?: AttachmentInfo;
    allegato2?: AttachmentInfo;
    allegato3?: AttachmentInfo;
    allegato4?: AttachmentInfo;
  };
};

function L({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[11px] font-medium text-slate-500">
      {children}
    </div>
  );
}
function V({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[13px] text-slate-800">
      {children ?? "—"}
    </div>
  );
}

export default function ShipmentDetail({ f }: { f: ShipRow }) {
  const [detail, setDetail] = useState<ShipDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // carico il dettaglio completo (inclusi attachments) dalla stessa API del back office
  useEffect(() => {
    if (!f?.id) return;
    let cancelled = false;

    (async () => {
      setLoadingDetail(true);
      try {
        const res = await fetch(
          `/api/spedizioni/${encodeURIComponent(f.id)}`,
          { cache: "no-store" }
        );
        const json = await res.json().catch(() => null);

        if (cancelled) return;

        if (json?.ok && json.shipment) {
          setDetail(json.shipment as ShipDetail);
        } else {
          setDetail(null);
        }
      } catch (err) {
        console.error("[ShipmentDetail] load detail error:", err);
        if (!cancelled) setDetail(null);
      } finally {
        if (!cancelled) setLoadingDetail(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [f?.id]);

  // uso i dati del dettaglio se disponibili, altrimenti il row di fallback
  const d = (detail || f) as ShipDetail;

  const mittAddr = [
    d.mittente_indirizzo,
    d.mittente_cap,
    d.mittente_citta,
    d.mittente_paese,
  ]
    .filter(Boolean)
    .join(", ");

  const destAddr = [d.dest_cap, d.dest_citta, d.dest_paese]
    .filter(Boolean)
    .join(", ");

  const rawPackages: any = (d as any).packages;
  const colli: Pkg[] = Array.isArray(rawPackages)
    ? rawPackages
    : Array.isArray((d as any).packages_preview)
    ? (d as any).packages_preview
    : [];

  const attachmentDefs = [
    { key: "ldv", label: "Lettera di vettura (LDV)" },
    { key: "fattura_commerciale", label: "Fattura commerciale" },
    { key: "fattura_proforma", label: "Fattura proforma" },
    { key: "dle", label: "Documento DLE" },
    { key: "allegato1", label: "Allegato 1" },
    { key: "allegato2", label: "Allegato 2" },
    { key: "allegato3", label: "Allegato 3" },
    { key: "allegato4", label: "Allegato 4" },
  ] as const;

  return (
    <div className="space-y-4">
      {/* ID */}
      <div>
        <L>ID Spedizione</L>
        <V>{d.human_id || d.id}</V>
      </div>

      {/* Mittente / Destinatario */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="rounded-lg border p-3">
          <L>Mittente</L>
          <V>{d.mittente_rs || "—"}</V>
          <V>{mittAddr || "—"}</V>
          <V>Tel: {d.mittente_telefono || "—"}</V>
          <div className="text-[11px] text-slate-500">
            P.IVA/CF: {d.mittente_piva || "—"}
          </div>
        </div>
        <div className="rounded-lg border p-3">
          <L>Destinatario</L>
          <V>{d.dest_rs || "—"}</V>
          <V>{destAddr || "—"}</V>
          <V>Tel: {d.dest_telefono || "—"}</V>
          <div className="text-[11px] text-slate-500">
            P.IVA/CF: {d.dest_piva || "—"}
          </div>
          <div className="text-[11px] text-slate-500">
            Abilitato import: {d.dest_abilitato_import ? "Sì" : "No"}
          </div>
        </div>
      </div>

      {/* Ritiro / Incoterm / Tipo */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="rounded-lg border p-3">
          <L>Data ritiro</L>
          <V>{d.giorno_ritiro || "—"}</V>
        </div>
        <div className="rounded-lg border p-3">
          <L>Incoterm</L>
          <V>{d.incoterm || "—"}</V>
        </div>
        <div className="rounded-lg border p-3">
          <L>Tipo spedizione</L>
          <V>{d.tipo_spedizione || "—"}</V>
        </div>
      </div>

      {/* Fatturazione */}
      <div className="rounded-lg border p-3">
        <L>Fatturazione</L>
        <V>{d.fatt_rs || "—"}</V>
        <div className="text-[11px] text-slate-500">
          P.IVA/CF: {d.fatt_piva || "—"}
        </div>
        <div className="text-[11px] text-slate-500">
          Valuta: {d.fatt_valuta || "—"}
        </div>
        <div className="mt-2 text-[11px] text-slate-500">
          Uguale a Destinatario: {d?.fields?.fattSameAsDest ? "Sì" : "No"} •{" "}
          Delega fattura a SPST:
          {d?.fields?.fattDelega ? " Sì" : " No"}
        </div>
      </div>

      {/* Colli */}
      <div className="rounded-lg border p-3">
        <L>Colli</L>
        {colli.length === 0 ? (
          <div className="text-[13px] text-slate-500">
            Nessun collo disponibile
          </div>
        ) : (
          <div className="mt-2 space-y-2">
            {colli.map((p, i) => (
              <div key={p.id || i} className="text-[13px]">
                <span className="font-medium">Collo {i + 1}:</span>{" "}
                {p.l1 ?? "–"}×{p.l2 ?? "–"}×{p.l3 ?? "–"} cm — Peso:{" "}
                {p.weight_kg ?? "–"} kg
                {p.contenuto ? <> — Contenuto: {p.contenuto}</> : null}
              </div>
            ))}
            {typeof d.packages_count === "number" &&
              d.packages_count > colli.length && (
                <div className="text-[11px] text-slate-500">
                  (+{d.packages_count - colli.length} altri colli…)
                </div>
              )}
          </div>
        )}
      </div>

      {/* Allegati */}
      <div className="rounded-lg border p-3">
        <L>Allegati</L>

        {loadingDetail && !detail ? (
          <div className="mt-2 text-xs text-slate-500">
            Caricamento allegati…
          </div>
        ) : !d.attachments ? (
          <div className="mt-2 text-xs text-slate-500">
            Nessun allegato disponibile per questa spedizione.
          </div>
        ) : (
          <div className="mt-2 flex flex-col gap-1 text-xs">
            {attachmentDefs.map(({ key, label }) => {
              const att = d.attachments?.[key];
              const hasFile = !!att && !!att.url;
              return (
                <div
                  key={key}
                  className="flex items-center justify-between rounded-md border px-2.5 py-1.5"
                >
                  <span className="text-slate-700">{label}</span>
                  {hasFile ? (
                    <a
                      href={att!.url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[11px] text-[#1c3e5e] underline"
                    >
                      Apri{att?.file_name ? ` (${att.file_name})` : ""}
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
        )}
      </div>
    </div>
  );
}
