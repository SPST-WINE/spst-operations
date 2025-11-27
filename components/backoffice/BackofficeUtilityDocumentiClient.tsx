// components/backoffice/BackofficeUtilityDocumentiClient.tsx
"use client";

import { useState } from "react";

const DOC_TYPES = [
  { value: "ddt", label: "DDT" },
  { value: "fattura_proforma", label: "Fattura Proforma" },
  { value: "fattura_commerciale", label: "Fattura Commerciale" },
  { value: "dle", label: "Dichiarazione di libera esportazione (DLE)" },
];

const COURIERS = [
  "TNT",
  "DHL",
  "UPS",
  "FEDEX",
  "SPST",
  "POSTE",
  "GLS",
  "BRT",
  "SDA",
];

type ShipmentSummary = {
  id: string;
  human_id: string | null;

  carrier: string | null;
  tracking_code: string | null;

  // Mittente
  mittente_rs?: string | null;
  mittente_indirizzo?: string | null;
  mittente_cap?: string | null;
  mittente_citta?: string | null;
  mittente_paese?: string | null;

  // Destinatario
  dest_rs?: string | null;
  dest_indirizzo?: string | null;
  dest_cap?: string | null;
  dest_citta?: string | null;
  dest_paese?: string | null;

  // Dati spedizione
  colli_n?: number | null;
  peso_reale_kg?: number | null;

  [key: string]: any;
};

type PackageRow = {
  id?: string;
  length_cm?: number | null;
  width_cm?: number | null;
  height_cm?: number | null;
  weight_kg?: number | null;
  contents?: string | null;
  fields?: any;
};

type PlLineRow = {
  id?: string;
  label?: string | null;
  item_type?: string | null;
  bottles?: number | null;
  volume_l?: number | null;
  unit_price?: number | null;
  currency?: string | null;
};

export default function BackofficeUtilityDocumentiClient() {
  const [humanIdInput, setHumanIdInput] = useState("");
  const [loadingShipment, setLoadingShipment] = useState(false);
  const [shipmentError, setShipmentError] = useState<string | null>(null);

  const [shipment, setShipment] = useState<ShipmentSummary | null>(null);
  const [packages, setPackages] = useState<PackageRow[]>([]);
  const [packingList, setPackingList] = useState<PlLineRow[]>([]);

  const [docType, setDocType] = useState<string>("");
  const [courier, setCourier] = useState<string>("");
  const [tracking, setTracking] = useState<string>("");

  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [debugPayload, setDebugPayload] = useState<any | null>(null);

  async function handleLoadShipment() {
    const id = humanIdInput.trim();
    if (!id) {
      setShipmentError("Inserisci un ID spedizione (es. SP-27-11-2025-00001).");
      return;
    }

    setLoadingShipment(true);
    setShipmentError(null);
    setShipment(null);
    setPackages([]);
    setPackingList([]);
    setDebugPayload(null);

    try {
      const res = await fetch(
        `/api/utility-documenti/shipment?human_id=${encodeURIComponent(id)}`
      );
      const json = await res.json().catch(() => ({}));

      if (!res.ok || !json?.ok) {
        throw new Error(
          json?.error ||
            json?.details ||
            `Errore ${res.status} nel caricamento spedizione`
        );
      }

      const sh = json.shipment as ShipmentSummary;
      setShipment(sh);

      // Colli + packing list
      setPackages((json.packages || []) as PackageRow[]);
      setPackingList((json.plLines || []) as PlLineRow[]);

      // Precompila courier + tracking se presenti
      setCourier(sh.carrier || "");
      setTracking(sh.tracking_code || "");
    } catch (e: any) {
      console.error("[utility-documenti] load shipment error:", e);
      setShipmentError(e?.message || "Errore nel caricamento della spedizione");
    } finally {
      setLoadingShipment(false);
    }
  }

  async function handleGenerate() {
    if (!shipment) {
      setGenerateError("Carica prima una spedizione.");
      return;
    }
    if (!docType) {
      setGenerateError("Seleziona il tipo di documento da generare.");
      return;
    }
    if (!courier) {
      setGenerateError("Seleziona il corriere di riferimento.");
      return;
    }

    setGenerating(true);
    setGenerateError(null);
    setDebugPayload(null);

    try {
      const res = await fetch("/api/utility-documenti/genera", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          human_id: shipment.human_id ?? humanIdInput.trim(),
          doc_type: docType,
          courier,
          tracking_code: tracking || null,
        }),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.ok) {
        throw new Error(
          json?.error ||
            json?.details ||
            `Errore ${res.status} nella generazione documento`
        );
      }

      setDebugPayload(json.doc || json);
    } catch (e: any) {
      console.error("[utility-documenti] generate error:", e);
      setGenerateError(e?.message || "Errore nella generazione del documento");
    } finally {
      setGenerating(false);
    }
  }

  const mittente = shipment && {
    ragioneSociale: shipment.mittente_rs,
    indirizzo: shipment.mittente_indirizzo,
    cap: shipment.mittente_cap,
    citta: shipment.mittente_citta,
    paese: shipment.mittente_paese,
  };

  const destinatario = shipment && {
    ragioneSociale: shipment.dest_rs,
    indirizzo: shipment.dest_indirizzo,
    cap: shipment.dest_cap,
    citta: shipment.dest_citta,
    paese: shipment.dest_paese,
  };

  const colliCount = shipment?.colli_n ?? packages.length ?? 0;
  const pesoTotale = shipment?.peso_reale_kg ?? null;

  return (
    <div className="space-y-6">
      {/* Card 1: selezione spedizione */}
      <section className="rounded-2xl border bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-900">
          1. Seleziona spedizione
        </h2>
        <p className="mt-1 text-xs text-slate-500">
          Inserisci l&apos;ID della spedizione (es. SP-27-11-2025-00001). Verranno
          letti mittente, destinatario, colli e packing list.
        </p>

        <div className="mt-4 flex flex-col gap-3 md:flex-row md:items-center">
          <div className="flex-1">
            <label className="text-xs font-medium text-slate-600">
              ID spedizione
            </label>
            <input
              type="text"
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900/10"
              value={humanIdInput}
              onChange={(e) => setHumanIdInput(e.target.value)}
              placeholder="SP-27-11-2025-00001"
            />
          </div>
          <button
            type="button"
            onClick={handleLoadShipment}
            disabled={loadingShipment || !humanIdInput.trim()}
            className="mt-2 inline-flex items-center justify-center rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300 md:mt-6"
          >
            {loadingShipment ? "Carico dati…" : "Carica spedizione"}
          </button>
        </div>

        {shipmentError && (
          <p className="mt-3 text-xs font-medium text-red-600">
            {shipmentError}
          </p>
        )}

        {shipment && (
          <div className="mt-5 space-y-4 rounded-xl bg-slate-50 p-4 text-xs text-slate-700">
            {/* Mittente / Destinatario */}
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <div className="text-[11px] font-semibold uppercase text-slate-500">
                  Mittente
                </div>
                <div className="mt-1 space-y-0.5">
                  <div>{mittente?.ragioneSociale || "—"}</div>
                  <div>{mittente?.indirizzo || "—"}</div>
                  <div>
                    {(mittente?.cap || "") +
                      (mittente?.cap ? " " : "") +
                      (mittente?.citta || "")}
                  </div>
                  <div>{mittente?.paese || "—"}</div>
                </div>
              </div>
              <div>
                <div className="text-[11px] font-semibold uppercase text-slate-500">
                  Destinatario
                </div>
                <div className="mt-1 space-y-0.5">
                  <div>{destinatario?.ragioneSociale || "—"}</div>
                  <div>{destinatario?.indirizzo || "—"}</div>
                  <div>
                    {(destinatario?.cap || "") +
                      (destinatario?.cap ? " " : "") +
                      (destinatario?.citta || "")}
                  </div>
                  <div>{destinatario?.paese || "—"}</div>
                </div>
              </div>
            </div>

            {/* Colli + Packing list */}
            <div className="grid gap-4 md:grid-cols-2">
              {/* Colli */}
              <div>
                <div className="mb-1 flex items-center justify-between">
                  <div className="text-[11px] font-semibold uppercase text-slate-500">
                    Colli
                  </div>
                  <div className="text-[11px] text-slate-500">
                    {colliCount > 0 && (
                      <>
                        {colliCount} collo{colliCount > 1 ? "i" : ""}{" "}
                        {pesoTotale ? `· ${pesoTotale} kg totali` : ""}
                      </>
                    )}
                  </div>
                </div>

                {packages.length === 0 ? (
                  <div className="text-[11px] italic text-slate-500">
                    Nessun collo registrato.
                  </div>
                ) : (
                  <ul className="space-y-1">
                    {packages.slice(0, 4).map((p, idx) => {
                      const dims =
                        p.length_cm && p.width_cm && p.height_cm
                          ? `${p.length_cm}×${p.width_cm}×${p.height_cm} cm`
                          : null;

                      const peso = p.weight_kg
                        ? `${p.weight_kg} kg`
                        : undefined;

                      const contents =
                        p.contents ||
                        (p.fields &&
                          (p.fields.contenuto ||
                            p.fields.contenuto_collo ||
                            p.fields.contents));

                      return (
                        <li
                          key={p.id || idx}
                          className="rounded-lg border border-slate-200 bg-white/60 px-3 py-2"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="text-[11px] font-medium text-slate-700">
                              Collo #{idx + 1}
                            </div>
                            <div className="text-[11px] text-slate-500">
                              {peso || "—"}
                            </div>
                          </div>
                          {dims && (
                            <div className="text-[11px] text-slate-500">
                              {dims}
                            </div>
                          )}
                          {contents && (
                            <div className="mt-0.5 text-[11px] text-slate-600 line-clamp-2">
                              {contents}
                            </div>
                          )}
                        </li>
                      );
                    })}

                    {packages.length > 4 && (
                      <li className="text-[11px] text-slate-500">
                        … e altri {packages.length - 4} colli.
                      </li>
                    )}
                  </ul>
                )}
              </div>

              {/* Packing list */}
              <div>
                <div className="mb-1 flex items-center justify-between">
                  <div className="text-[11px] font-semibold uppercase text-slate-500">
                    Packing list
                  </div>
                  {packingList.length > 0 && (
                    <div className="text-[11px] text-slate-500">
                      {packingList.length} voce
                      {packingList.length > 1 ? "i" : ""}
                    </div>
                  )}
                </div>

                {packingList.length === 0 ? (
                  <div className="text-[11px] italic text-slate-500">
                    Nessuna riga di packing list.
                  </div>
                ) : (
                  <ul className="space-y-1">
                    {packingList.slice(0, 4).map((r, idx) => {
                      const qty = r.bottles ?? null;
                      const vol = r.volume_l ?? null;
                      const price =
                        r.unit_price != null
                          ? `${r.unit_price} ${r.currency || ""}`.trim()
                          : null;

                      return (
                        <li
                          key={r.id || idx}
                          className="rounded-lg border border-slate-200 bg-white/60 px-3 py-2"
                        >
                          <div className="text-[11px] font-medium text-slate-700 line-clamp-2">
                            {r.label || "Voce packing list"}
                          </div>
                          <div className="mt-0.5 flex flex-wrap gap-2 text-[11px] text-slate-500">
                            {qty != null && <span>{qty} bt</span>}
                            {vol != null && <span>{vol} L totali</span>}
                            {price && <span>· {price}</span>}
                          </div>
                        </li>
                      );
                    })}

                    {packingList.length > 4 && (
                      <li className="text-[11px] text-slate-500">
                        … e altre {packingList.length - 4} righe.
                      </li>
                    )}
                  </ul>
                )}
              </div>
            </div>
          </div>
        )}
      </section>

      {/* Card 2: configurazione documento */}
      <section className="rounded-2xl border bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-900">
          2. Configura documento
        </h2>
        <p className="mt-1 text-xs text-slate-500">
          Seleziona il tipo di documento, il corriere e il tracking. I valori
          possono essere modificati anche se letti automaticamente dalla
          spedizione.
        </p>

        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-slate-600">
              Tipo documento
            </label>
            <select
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900/10"
              value={docType}
              onChange={(e) => setDocType(e.target.value)}
            >
              <option value="">Seleziona…</option>
              {DOC_TYPES.map((d) => (
                <option key={d.value} value={d.value}>
                  {d.label}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-slate-600">
              Corriere
            </label>
            <select
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900/10"
              value={courier}
              onChange={(e) => setCourier(e.target.value)}
            >
              <option value="">Seleziona…</option>
              {COURIERS.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-slate-600">
              Tracking (modificabile)
            </label>
            <input
              type="text"
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900/10"
              value={tracking}
              onChange={(e) => setTracking(e.target.value)}
              placeholder="Numero di tracking"
            />
          </div>
        </div>
      </section>

      {/* Card 3: azione */}
      <section className="rounded-2xl border bg-white p-5 shadow-sm">
        <div className="flex flex-col items-start justify-between gap-3 md:flex-row md:items-center">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">
              3. Genera documento (scheletro)
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              Per ora l&apos;API restituisce un JSON con tutti i dati necessari
              (mittente, destinatario, fattura, colli, packing list). In un
              secondo step collegheremo il generatore PDF.
            </p>
          </div>

          <button
            type="button"
            onClick={handleGenerate}
            disabled={generating || !shipment}
            className="inline-flex items-center justify-center rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:bg-emerald-300"
          >
            {generating ? "Genero documento…" : "Genera documento (placeholder)"}
          </button>
        </div>

        {generateError && (
          <p className="mt-3 text-xs font-medium text-red-600">
            {generateError}
          </p>
        )}

        {debugPayload && (
          <div className="mt-4 max-h-72 overflow-auto rounded-xl bg-slate-950 p-4 text-[11px] text-slate-50">
            <pre className="whitespace-pre-wrap break-all">
              {JSON.stringify(debugPayload, null, 2)}
            </pre>
          </div>
        )}
      </section>
    </div>
  );
}
