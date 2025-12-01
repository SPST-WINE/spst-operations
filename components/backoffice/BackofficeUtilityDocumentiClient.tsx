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

// DocData per editor
type DocData = {
  meta: any;
  parties: any;
  shipment: any;
  items: any[];
  totals: any;
};

type DraftUpdater = (prev: DocData) => DocData;

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

  // documento base + bozza editabile + anteprima
  const [baseDoc, setBaseDoc] = useState<DocData | null>(null);
  const [draftDoc, setDraftDoc] = useState<DocData | null>(null);
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);

  // show/hide JSON debug
  const [showJson, setShowJson] = useState(false);

  // ---------- LOAD SPEDIZIONE ----------

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
    setPreviewHtml(null);
    setBaseDoc(null);
    setDraftDoc(null);

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

      // Colli da tabella (se ci sono)
      setPackages((json.packages || []) as PackageRow[]);

      // PACKING LIST da shipment.fields.packingList
      let plFinal: PlLineRow[] = [];

      const maybePacking = (sh as any)?.fields?.packingList;
      if (Array.isArray(maybePacking) && maybePacking.length > 0) {
        plFinal = maybePacking.map((row: any, idx: number): PlLineRow => {
          const bottles: number | null =
            row.bottiglie ?? row.qty ?? row.quantita ?? null;

          const formatLiters: number | null =
            row.formato_litri ?? row.volume_litri ?? null;

          const totalVolume: number | null =
            bottles != null && formatLiters != null
              ? bottles * formatLiters
              : null;

          return {
            id: `${sh.id}-json-${idx}`,
            label:
              row.etichetta || row.label || row.nome || "Voce packing list",
            item_type: row.tipologia || row.item_type || null,
            bottles,
            volume_l: totalVolume,
            unit_price: row.prezzo ?? row.unit_price ?? null,
            currency: row.valuta || row.currency || null,
          };
        });
      }

      setPackingList(plFinal);

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

  // ---------- GENERA DOCUMENTO BASE ----------

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
    setPreviewHtml(null);

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
      setPreviewHtml(json.html || null);

      if (json.doc) {
        setBaseDoc(json.doc);
        setDraftDoc(json.doc);
      }
    } catch (e: any) {
      console.error("[utility-documenti] generate error:", e);
      setGenerateError(e?.message || "Errore nella generazione del documento");
    } finally {
      setGenerating(false);
    }
  }

  // ---------- HELPER EDITOR DOC ----------

  const updateDraft = (updater: DraftUpdater) => {
    setDraftDoc((prev) => {
      if (!prev) return prev;
      return updater(prev);
    });
  };

  const updatePartyField = (partyKey: string, field: string, value: any) => {
    setDraftDoc((prev) => {
      if (!prev) return prev;
      const prevParties = prev.parties || {};
      const prevParty = prevParties[partyKey] || {};
      return {
        ...prev,
        parties: {
          ...prevParties,
          [partyKey]: {
            ...prevParty,
            [field]: value,
          },
        },
      };
    });
  };

  const updatePartyAddress = (
    partyKey: string,
    field: string,
    value: any
  ) => {
    setDraftDoc((prev) => {
      if (!prev) return prev;
      const prevParties = prev.parties || {};
      const prevParty = prevParties[partyKey] || {};
      const prevAddress = prevParty.address || {};
      return {
        ...prev,
        parties: {
          ...prevParties,
          [partyKey]: {
            ...prevParty,
            address: {
              ...prevAddress,
              [field]: value,
            },
          },
        },
      };
    });
  };

  const updateItemField = (idx: number, field: string, value: any) => {
    setDraftDoc((prev) => {
      if (!prev) return prev;
      const items = Array.isArray(prev.items) ? [...prev.items] : [];
      const current = items[idx] || {};
      items[idx] = { ...current, [field]: value };
      return {
        ...prev,
        items,
      };
    });
  };

  const duplicateItem = (idx: number) => {
    setDraftDoc((prev) => {
      if (!prev || !Array.isArray(prev.items)) return prev;
      const copy = { ...prev.items[idx] };
      const newItems = [...prev.items];
      newItems.splice(idx + 1, 0, copy);
      return { ...prev, items: newItems };
    });
  };

  const deleteItem = (idx: number) => {
    setDraftDoc((prev) => {
      if (!prev || !Array.isArray(prev.items)) return prev;
      const newItems = prev.items.filter((_, i) => i !== idx);
      return { ...prev, items: newItems };
    });
  };

  const handleRenderPreview = async () => {
    if (!draftDoc) return;

    setGenerateError(null);

    const effectiveDocType =
      (draftDoc.meta && draftDoc.meta.docType) || docType || "fattura_proforma";

    try {
      const res = await fetch("/api/utility-documenti/genera", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          doc_type: effectiveDocType,
          doc_data: draftDoc,
        }),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.ok) {
        throw new Error(
          json?.error ||
            json?.details ||
            `Errore ${res.status} nel rendering documento`
        );
      }

      if (json.doc) {
        setDraftDoc(json.doc);
        setBaseDoc(json.doc);
        setDebugPayload(json.doc);
      } else {
        setDebugPayload(json);
      }
      setPreviewHtml(json.html || null);
    } catch (e: any) {
      console.error("[utility-documenti] render doc error:", e);
      setGenerateError(
        e?.message || "Errore nel rendering / aggiornamento del documento"
      );
    }
  };

  // ---------- DOWNLOAD PDF (window.print) ----------

  const handleDownloadPdf = () => {
    if (typeof window === "undefined") return;

    // piccolo delay se l'anteprima è appena stata aggiornata
    setTimeout(() => {
      window.print();
    }, 100);
  };

  // ---------- DERIVATI PER CARD 1 ----------

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

  const mittenteAddress =
    mittente &&
    [
      mittente.ragioneSociale,
      mittente.indirizzo,
      [mittente.cap, mittente.citta].filter(Boolean).join(" "),
      mittente.paese,
    ]
      .filter(Boolean)
      .join("\n");

  const destinatarioAddress =
    destinatario &&
    [
      destinatario.ragioneSociale,
      destinatario.indirizzo,
      [destinatario.cap, destinatario.citta].filter(Boolean).join(" "),
      destinatario.paese,
    ]
      .filter(Boolean)
      .join("\n");

  const colliCount = shipment?.colli_n ?? 0;
  const pesoTotale = shipment?.peso_reale_kg ?? null;

  return (
    <div className="space-y-6">
      {/* Card 1: selezione spedizione */}
      <section className="rounded-2xl border bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-900">
          1. Seleziona spedizione
        </h2>
        <p className="mt-1 text-xs text-slate-500">
          Inserisci l&apos;ID della spedizione (es. SP-27-11-2025-00001).
          Verranno letti mittente, destinatario, colli e packing list.
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
          <div className="mt-5">
            <div className="rounded-2xl border bg-white p-4 text-sm">
              <div className="grid gap-6 md:grid-cols-2">
                {/* MITTENTE + COLLI */}
                <div className="space-y-3">
                  <div className="text-[11px] font-semibold text-slate-500">
                    MITTENTE
                  </div>
                  <div className="whitespace-pre-line text-sm text-slate-800">
                    {mittenteAddress || "—"}
                  </div>

                  <div className="mt-3 text-[11px] font-semibold text-slate-500">
                    COLLI
                  </div>
                  {colliCount && colliCount > 0 ? (
                    <div className="text-xs text-slate-700">
                      {colliCount} collo
                      {colliCount > 1 ? "i" : ""}{" "}
                      {typeof pesoTotale === "number" && (
                        <>· {pesoTotale} kg totali</>
                      )}
                    </div>
                  ) : (
                    <div className="text-xs italic text-slate-400">
                      Nessun collo registrato.
                    </div>
                  )}
                </div>

                {/* DESTINATARIO + PACKING LIST */}
                <div className="space-y-3">
                  <div className="text-[11px] font-semibold text-slate-500">
                    DESTINATARIO
                  </div>
                  <div className="whitespace-pre-line text-sm text-slate-800">
                    {destinatarioAddress || "—"}
                  </div>

                  <div className="mt-3 text-[11px] font-semibold text-slate-500">
                    PACKING LIST
                  </div>
                  {packingList && packingList.length > 0 ? (
                    <ul className="space-y-1 text-xs text-slate-700">
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
                  ) : (
                    <div className="text-xs italic text-slate-400">
                      Nessuna riga di packing list.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* Card 2: configurazione documento */}
      <section className="rounded-2xl border bg_WHITE p-5 shadow-sm">
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

      {/* CARD 3 — GENERA DOCUMENTO */}
      <div className="rounded-xl border border-slate-200 bg-white p-6">
        {/* Header card: titolo + bottone genera */}
        <div className="flex flex-col items-start justify-between gap-3 md:flex-row md:items-center">
          <div>
            <div className="text-lg font-semibold text-slate-800">
              3. Genera e modifica il documento
            </div>
            <p className="mt-1 text-xs text-slate-500">
              Genera lo scheletro del documento dalla spedizione, poi modifica i
              dati (meta, soggetti, spedizione, items, note) e aggiorna
              l&apos;anteprima in tempo reale.
            </p>
          </div>

          <button
            type="button"
            onClick={handleGenerate}
            disabled={generating || !shipment || !docType || !courier}
            className="inline-flex items-center justify-center rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:bg-emerald-300"
          >
            {generating ? "Genero documento…" : "Genera documento da spedizione"}
          </button>
        </div>

        {generateError && (
          <p className="mt-3 text-xs font-medium text-red-600">
            {generateError}
          </p>
        )}

        {/* Layout a due colonne 50/50 */}
        <div className="mt-4 grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* ======== COLONNA SINISTRA (JSON + EDITOR) ======== */}
          <div className="space-y-6">
            {/* JSON DEBUG COLLASSABILE */}
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="mb-2 flex items-center justify_between">
                <div className="text-sm font-medium text-slate-700">
                  API Response (debug)
                </div>
                <button
                  onClick={() => setShowJson((s) => !s)}
                  className="rounded-md border border-slate-300 px-2 py-1 text-xs hover:bg-white"
                  type="button"
                >
                  {showJson ? "Nascondi JSON" : "Mostra JSON"}
                </button>
              </div>

              {showJson && (
                <pre className="max-h-72 overflow-x-auto rounded-md bg-black p-3 text-xs text-green-400">
                  {JSON.stringify(debugPayload, null, 2)}
                </pre>
              )}
            </div>

            {/* ====================== EDITOR DOC ====================== */}
            {draftDoc && (
              <div className="rounded-xl border border-slate-200 bg-white p-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div className="text-sm font-semibold text-slate-800">
                    Editor dati documento (completo)
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={handleRenderPreview}
                      className="rounded-md bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800"
                    >
                      Aggiorna anteprima
                    </button>

                    <button
                      type="button"
                      onClick={handleDownloadPdf}
                      className="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700"
                    >
                      Scarica PDF
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        if (baseDoc) {
                          setDraftDoc(baseDoc);
                          setPreviewHtml(null);
                          setDebugPayload(baseDoc);
                        }
                      }}
                      className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
                    >
                      Reset da spedizione
                    </button>
                  </div>
                </div>

                {/* META */}
                <div className="mb-6 mt-4">
                  <div className="mb-2 text-xs font-semibold text-slate-500">
                    Meta
                  </div>
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                    {/* Numero documento */}
                    <div>
                      <label className="block text-[11px] text-slate-500">
                        Numero documento
                      </label>
                      <input
                        type="text"
                        className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1 text-xs"
                        value={draftDoc.meta?.docNumber ?? ""}
                        onChange={(e) =>
                          updateDraft((d) => ({
                            ...d,
                            meta: { ...d.meta, docNumber: e.target.value },
                          }))
                        }
                      />
                    </div>

                    {/* Data */}
                    <div>
                      <label className="block text-[11px] text-slate-500">
                        Data documento
                      </label>
                      <input
                        type="date"
                        className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1 text-xs"
                        value={draftDoc.meta?.docDate ?? ""}
                        onChange={(e) =>
                          updateDraft((d) => ({
                            ...d,
                            meta: { ...d.meta, docDate: e.target.value },
                          }))
                        }
                      />
                    </div>

                    {/* Incoterm */}
                    <div>
                      <label className="block text-[11px] text-slate-500">
                        Incoterm
                      </label>
                      <input
                        type="text"
                        className="mt-1 w_full rounded-md border border-slate-300 px-2 py-1 text-xs"
                        value={draftDoc.meta?.incoterm ?? ""}
                        onChange={(e) =>
                          updateDraft((d) => ({
                            ...d,
                            meta: { ...d.meta, incoterm: e.target.value },
                          }))
                        }
                      />
                    </div>
                  </div>

                  {/* Courier + Tracking */}
                  <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
                    <div>
                      <label className="block text-[11px] text-slate-500">
                        Courier
                      </label>
                      <input
                        type="text"
                        className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1 text-xs"
                        value={draftDoc.meta?.courier ?? ""}
                        onChange={(e) =>
                          updateDraft((d) => ({
                            ...d,
                            meta: { ...d.meta, courier: e.target.value },
                          }))
                        }
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] text-slate-500">
                        Tracking
                      </label>
                      <input
                        type="text"
                        className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1 text-xs"
                        value={draftDoc.meta?.trackingCode ?? ""}
                        onChange={(e) =>
                          updateDraft((d) => ({
                            ...d,
                            meta: { ...d.meta, trackingCode: e.target.value },
                          }))
                        }
                      />
                    </div>
                  </div>

                  {/* NOTE DOCUMENTO */}
                  <div className="mt-6">
                    <label className="mb-1 block text-[11px] text-slate-500">
                      Note documento
                    </label>
                    <textarea
                      rows={3}
                      className="w-full rounded-md border border-slate-300 px-2 py-1 text-xs"
                      value={draftDoc.meta?.docNotes ?? ""}
                      onChange={(e) =>
                        updateDraft((d) => ({
                          ...d,
                          meta: { ...d.meta, docNotes: e.target.value },
                        }))
                      }
                    />
                  </div>
                </div>

                {/* ====================== PARTIES ====================== */}
                <div className="border-t border-slate-200 pt-4">
                  <div className="mb-2 text-xs font-semibold text-slate-500">
                    Soggetti
                  </div>

                  {["shipper", "consignee", "billTo"].map((partyKey) => (
                    <div
                      key={partyKey}
                      className="mb-6 border-b border-slate-100 pb-4"
                    >
                      <div className="mb-2 text-[11px] font-semibold uppercase text-slate-600">
                        {partyKey === "shipper"
                          ? "Mittente"
                          : partyKey === "consignee"
                          ? "Destinatario"
                          : "Fatturazione"}
                      </div>

                      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                        {/* Nome */}
                        <div>
                          <label className="block text-[11px] text-slate-500">
                            Nome
                          </label>
                          <input
                            type="text"
                            className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1 text-xs"
                            value={draftDoc.parties?.[partyKey]?.name ?? ""}
                            onChange={(e) =>
                              updatePartyField(
                                partyKey,
                                "name",
                                e.target.value
                              )
                            }
                          />
                        </div>

                        {/* Referente */}
                        <div>
                          <label className="block text-[11px] text-slate-500">
                            Referente
                          </label>
                          <input
                            type="text"
                            className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1 text-xs"
                            value={draftDoc.parties?.[partyKey]?.contact ?? ""}
                            onChange={(e) =>
                              updatePartyField(
                                partyKey,
                                "contact",
                                e.target.value
                              )
                            }
                          />
                        </div>

                        {/* Indirizzo */}
                        <div className="md:col-span-2">
                          <label className="block text-[11px] text-slate-500">
                            Indirizzo
                          </label>
                          <input
                            type="text"
                            className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1 text-xs"
                            value={
                              draftDoc.parties?.[partyKey]?.address?.line1 ?? ""
                            }
                            onChange={(e) =>
                              updatePartyAddress(
                                partyKey,
                                "line1",
                                e.target.value
                              )
                            }
                          />
                        </div>

                        {/* Città / CAP */}
                        <div>
                          <label className="block text-[11px] text-slate-500">
                            Città
                          </label>
                          <input
                            type="text"
                            className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1 text-xs"
                            value={
                              draftDoc.parties?.[partyKey]?.address?.city ?? ""
                            }
                            onChange={(e) =>
                              updatePartyAddress(
                                partyKey,
                                "city",
                                e.target.value
                              )
                            }
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] text-slate-500">
                            CAP
                          </label>
                          <input
                            type="text"
                            className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1 text-xs"
                            value={
                              draftDoc.parties?.[partyKey]?.address
                                ?.postalCode ?? ""
                            }
                            onChange={(e) =>
                              updatePartyAddress(
                                partyKey,
                                "postalCode",
                                e.target.value
                              )
                            }
                          />
                        </div>

                        {/* Paese */}
                        <div className="md:col-span-2">
                          <label className="block text-[11px] text-slate-500">
                            Paese
                          </label>
                          <input
                            type="text"
                            className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1 text-xs"
                            value={
                              draftDoc.parties?.[partyKey]?.address?.country ??
                              ""
                            }
                            onChange={(e) =>
                              updatePartyAddress(
                                partyKey,
                                "country",
                                e.target.value
                              )
                            }
                          />
                        </div>

                        {/* PIVA */}
                        <div>
                          <label className="block text-[11px] text-slate-500">
                            P.IVA / Tax ID
                          </label>
                          <input
                            type="text"
                            className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1 text-xs"
                            value={
                              draftDoc.parties?.[partyKey]?.vatNumber ?? ""
                            }
                            onChange={(e) =>
                              updatePartyField(
                                partyKey,
                                "vatNumber",
                                e.target.value
                              )
                            }
                          />
                        </div>

                        {/* Telefono */}
                        <div>
                          <label className="block text-[11px] text-slate-500">
                            Telefono
                          </label>
                          <input
                            type="text"
                            className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1 text-xs"
                            value={draftDoc.parties?.[partyKey]?.phone ?? ""}
                            onChange={(e) =>
                              updatePartyField(
                                partyKey,
                                "phone",
                                e.target.value
                              )
                            }
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* ====================== SHIPMENT ====================== */}
                <div className="border-t border-slate-200 pt-4">
                  <div className="mb-2 text-xs font-semibold text-slate-500">
                    Dati spedizione
                  </div>

                  <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                    {/* Colli */}
                    <div>
                      <label className="block text-[11px] text-slate-500">
                        Colli
                      </label>
                      <input
                        type="number"
                        className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1 text-xs"
                        value={draftDoc.shipment?.totalPackages ?? ""}
                        onChange={(e) =>
                          updateDraft((d) => ({
                            ...d,
                            shipment: {
                              ...d.shipment,
                              totalPackages: Number(e.target.value),
                            },
                          }))
                        }
                      />
                    </div>

                    {/* Peso */}
                    <div>
                      <label className="block text-[11px] text-slate-500">
                        Peso lordo (kg)
                      </label>
                      <input
                        type="number"
                        className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1 text-xs"
                        value={draftDoc.shipment?.totalGrossWeightKg ?? ""}
                        onChange={(e) =>
                          updateDraft((d) => ({
                            ...d,
                            shipment: {
                              ...d.shipment,
                              totalGrossWeightKg: Number(e.target.value),
                            },
                          }))
                        }
                      />
                    </div>

                    {/* Pickup date */}
                    <div>
                      <label className="block text-[11px] text-slate-500">
                        Pickup date
                      </label>
                      <input
                        type="date"
                        className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1 text-xs"
                        value={draftDoc.shipment?.pickupDate ?? ""}
                        onChange={(e) =>
                          updateDraft((d) => ({
                            ...d,
                            shipment: {
                              ...d.shipment,
                              pickupDate: e.target.value,
                            },
                          }))
                        }
                      />
                    </div>
                  </div>

                  {/* descrizione */}
                  <div className="mt-3">
                    <label className="block text-[11px] text-slate-500">
                      Descrizione merce
                    </label>
                    <input
                      type="text"
                      className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1 text-xs"
                      value={draftDoc.shipment?.contentSummary ?? ""}
                      onChange={(e) =>
                        updateDraft((d) => ({
                          ...d,
                          shipment: {
                            ...d.shipment,
                            contentSummary: e.target.value,
                          },
                        }))
                      }
                    />
                  </div>
                </div>

                {/* ====================== ITEMS ====================== */}
                <div className="border-t border-slate-200 pt-4">
                  <div className="mb-2 text-xs font-semibold text-slate-500">
                    Items
                  </div>

                  {draftDoc.items?.map((it: any, idx: number) => (
                    <div
                      key={idx}
                      className="relative mb-3 rounded-lg border border-slate-100 p-3"
                    >
                      {/* bottoni duplica / cancella */}
                      <div className="absolute right-2 top-2 flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => duplicateItem(idx)}
                          className="rounded border border-slate-300 px-2 py-0.5 text-[11px] hover:bg-slate-100"
                        >
                          + Duplica
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteItem(idx)}
                          className="rounded border border-red-300 px-2 py-0.5 text-[11px] text-red-600 hover:bg-red-50"
                        >
                          ✕
                        </button>
                      </div>

                      <div className="mb-2 grid grid-cols-1 gap-2 md:grid-cols-3">
                        {/* Descrizione */}
                        <div className="md:col-span-3">
                          <label className="block text-[11px] text-slate-500">
                            Descrizione
                          </label>
                          <input
                            type="text"
                            className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1 text-xs"
                            value={it.description ?? ""}
                            onChange={(e) =>
                              updateItemField(
                                idx,
                                "description",
                                e.target.value
                              )
                            }
                          />
                        </div>

                        {/* Bottiglie */}
                        <div>
                          <label className="block text-[11px] text-slate-500">
                            Bottiglie
                          </label>
                          <input
                            type="number"
                            className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1 text-xs"
                            value={it.bottles ?? ""}
                            onChange={(e) =>
                              updateItemField(
                                idx,
                                "bottles",
                                Number(e.target.value)
                              )
                            }
                          />
                        </div>

                        {/* Litri */}
                        <div>
                          <label className="block text-[11px] text-slate-500">
                            Litri/bottiglia
                          </label>
                          <input
                            type="number"
                            step="0.01"
                            className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1 text-xs"
                            value={it.volumePerBottleL ?? ""}
                            onChange={(e) =>
                              updateItemField(
                                idx,
                                "volumePerBottleL",
                                Number(e.target.value)
                              )
                            }
                          />
                        </div>

                        {/* Volume totale */}
                        <div>
                          <label className="block text-[11px] text-slate-500">
                            Volume totale (L)
                          </label>
                          <input
                            type="number"
                            step="0.01"
                            className="mt-1 w_full rounded-md border border-slate-300 px-2 py-1 text-xs"
                            value={it.totalVolumeL ?? ""}
                            onChange={(e) =>
                              updateItemField(
                                idx,
                                "totalVolumeL",
                                Number(e.target.value)
                              )
                            }
                          />
                        </div>

                        {/* Prezzo unitario */}
                        <div>
                          <label className="block text-[11px] text-slate-500">
                            Prezzo unitario
                          </label>
                          <input
                            type="number"
                            step="0.01"
                            className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1 text-xs"
                            value={it.unitPrice ?? ""}
                            onChange={(e) =>
                              updateItemField(
                                idx,
                                "unitPrice",
                                Number(e.target.value)
                              )
                            }
                          />
                        </div>

                        {/* Totale riga */}
                        <div>
                          <label className="block text-[11px] text-slate-500">
                            Line total
                          </label>
                          <input
                            type="number"
                            step="0.01"
                            className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1 text-xs"
                            value={it.lineTotal ?? ""}
                            onChange={(e) =>
                              updateItemField(
                                idx,
                                "lineTotal",
                                Number(e.target.value)
                              )
                            }
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

                  {/* ======== COLONNA DESTRA: ANTEPRIMA DOCUMENTO ======== */}
          <div>
            {/* Wrapper scrollabile */}
            <div className="rounded-xl border border-slate-300 bg-slate-50 p-4 max-h-[700px] max-w-full overflow-auto">
              {previewHtml ? (
                <div
                  id="doc-preview"
                  className="mx-auto min-w-[800px] rounded-xl border bg-white p-6 shadow-sm"
                  dangerouslySetInnerHTML={{ __html: previewHtml }}
                />
              ) : (
                <div className="p-6 text-sm text-slate-500">
                  Genera il documento e/o aggiorna la bozza per vedere
                  l&apos;anteprima.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>


      {/* CSS di stampa: mostra solo #doc-preview */}
      <style jsx global>{`
        @media print {
          body * {
            visibility: hidden;
          }

          #doc-preview,
          #doc-preview * {
            visibility: visible;
          }

          #doc-preview {
            position: absolute;
            inset: 0;
            margin: 0;
            padding: 20mm;
            box-shadow: none !important;
            border: none !important;
          }
        }
      `}</style>
    </div>
  );
}
