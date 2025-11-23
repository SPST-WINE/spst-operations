// components/ShipmentDetail.tsx
"use client";

import { useEffect, useState } from "react";

type Pkg = {
  id: string;
  l1: number | null;
  l2: number | null;
  l3: number | null;
  weight_kg: number | null;
  contenuto?: string | null;
};

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

  // anteprima colli (server)
  packages_count?: number;
  packages_preview?: Pkg[];

  // blob originale
  fields?: any;
};

type DocAttachment = {
  id: string;
  type: string;
  label: string;
  url: string | null;
  fileName: string | null;
  mimeType?: string | null;
  size?: number | null;
  createdAt?: string | null;
};

function L({ children }: { children: React.ReactNode }) {
  return <div className="text-[11px] font-medium text-slate-500">{children}</div>;
}
function V({ children }: { children: React.ReactNode }) {
  return <div className="text-[13px] text-slate-800">{children ?? "—"}</div>;
}

export default function ShipmentDetail({ f }: { f: ShipRow }) {
  const mittAddr = [f.mittente_indirizzo, f.mittente_cap, f.mittente_citta, f.mittente_paese]
    .filter(Boolean)
    .join(", ");
  const destAddr = [f.dest_cap, f.dest_citta, f.dest_paese].filter(Boolean).join(", ");

  const colli = Array.isArray(f.packages_preview) ? f.packages_preview : [];

  const [attachments, setAttachments] = useState<DocAttachment[]>([]);
  const [attLoading, setAttLoading] = useState(false);

  useEffect(() => {
    if (!f?.id) return;
    let cancelled = false;

    (async () => {
      setAttLoading(true);
      try {
        const res = await fetch(
          `/api/spedizioni/${encodeURIComponent(f.id)}/attachments`,
          {
            method: "GET",
            cache: "no-store",
          }
        );
        const json = await res.json().catch(() => null);

        if (cancelled) return;

        if (json?.ok && Array.isArray(json.attachments)) {
          setAttachments(json.attachments as DocAttachment[]);
        } else {
          setAttachments([]);
        }
      } catch (err) {
        console.error("[ShipmentDetail] attachments load error:", err);
        if (!cancelled) setAttachments([]);
      } finally {
        if (!cancelled) setAttLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [f?.id]);

  return (
    <div className="space-y-4">
      {/* ID */}
      <div>
        <L>ID Spedizione</L>
        <V>{f.human_id || f.id}</V>
      </div>

      {/* Mittente / Destinatario */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="rounded-lg border p-3">
          <L>Mittente</L>
          <V>{f.mittente_rs || "—"}</V>
          <V>{mittAddr || "—"}</V>
          <V>Tel: {f.mittente_telefono || "—"}</V>
          <div className="text-[11px] text-slate-500">
            P.IVA/CF: {f.mittente_piva || "—"}
          </div>
        </div>
        <div className="rounded-lg border p-3">
          <L>Destinatario</L>
          <V>{f.dest_rs || "—"}</V>
          <V>{destAddr || "—"}</V>
          <V>Tel: {f.dest_telefono || "—"}</V>
          <div className="text-[11px] text-slate-500">
            P.IVA/CF: {f.dest_piva || "—"}
          </div>
          <div className="text-[11px] text-slate-500">
            Abilitato import: {f.dest_abilitato_import ? "Sì" : "No"}
          </div>
        </div>
      </div>

      {/* Ritiro / Incoterm / Tipo */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="rounded-lg border p-3">
          <L>Data ritiro</L>
          <V>{f.giorno_ritiro || "—"}</V>
        </div>
        <div className="rounded-lg border p-3">
          <L>Incoterm</L>
          <V>{f.incoterm || "—"}</V>
        </div>
        <div className="rounded-lg border p-3">
          <L>Tipo spedizione</L>
          <V>{f.tipo_spedizione || "—"}</V>
        </div>
      </div>

      {/* Fatturazione */}
      <div className="rounded-lg border p-3">
        <L>Fatturazione</L>
        <V>{f.fatt_rs || "—"}</V>
        <div className="text-[11px] text-slate-500">
          P.IVA/CF: {f.fatt_piva || "—"}
        </div>
        <div className="text-[11px] text-slate-500">
          Valuta: {f.fatt_valuta || "—"}
        </div>
        <div className="mt-2 text-[11px] text-slate-500">
          Uguale a Destinatario: {f?.fields?.fattSameAsDest ? "Sì" : "No"} •
          {" "}Delega fattura a SPST:
          {f?.fields?.fattDelega ? " Sì" : " No"}
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
            {typeof f.packages_count === "number" &&
              f.packages_count > colli.length && (
                <div className="text-[11px] text-slate-500">
                  (+{f.packages_count - colli.length} altri colli…)
                </div>
              )}
          </div>
        )}
      </div>

      {/* Allegati */}
      <div className="rounded-lg border p-3">
        <L>Allegati</L>

        {attLoading ? (
          <div className="mt-2 text-xs text-slate-500">
            Caricamento allegati…
          </div>
        ) : !attachments.length ? (
          <div className="mt-2 text-xs text-slate-500">
            Nessun allegato disponibile per questa spedizione.
          </div>
        ) : (
          <div className="mt-2 flex flex-wrap gap-2">
            {attachments.map((d) => (
              <a
                key={d.id}
                href={d.url || "#"}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 rounded-md border px-2.5 py-1.5 text-xs hover:bg-slate-50"
              >
                <span>{d.label}</span>
                {d.fileName ? (
                  <span className="text-[10px] text-slate-400 max-w-[160px] truncate">
                    {d.fileName}
                  </span>
                ) : null}
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
