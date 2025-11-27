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

  // nuovi stati per documento base + bozza editabile + anteprima
  const [baseDoc, setBaseDoc] = useState<DocData | null>(null);
  const [draftDoc, setDraftDoc] = useState<DocData | null>(null);
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);

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

      // ------- PACKING LIST SOLO DA JSON shipment.fields.packingList -------
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

      // nuovo: salviamo doc come base + bozza editabile
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

  // Stringhe multilinea per la card riepilogo
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

      {/* Card 3: azione + debug + anteprima */}
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

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleGenerate}
              disabled={generating || !shipment}
              className="inline-flex items-center justify-center rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:bg-emerald-300"
            >
              {generating
                ? "Genero documento…"
                : "Genera documento (placeholder)"}
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
              disabled={!baseDoc}
              className="inline-flex items-center justify-center rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium text-slate-600 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Reset dai dati spedizione
            </button>
          </div>
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

        {previewHtml && (
          <div className="mt-4">
            <div className="mb-2 text-xs font-medium text-slate-600">
              Anteprima documento (HTML)
            </div>
            <div className="h-[480px] w-full overflow-hidden rounded-xl border border-slate-200">
              <iframe
                title="Anteprima documento"
                srcDoc={previewHtml}
                className="h-full w-full"
              />
            </div>
          </div>
        )}

        {/* Editor bozza DocData */}
        {draftDoc && (
          <div className="mt-6 rounded-xl border border-slate-200 bg-white p-4">
            <div className="mb-3 text-sm font-semibold text-slate-800">
              Editor dati documento (bozza)
            </div>

            {/* Meta */}
            <div className="mb-4 grid gap-3 md:grid-cols-3">
              <div>
                <label className="block text-[11px] font-medium text-slate-500">
                  Numero documento
                </label>
                <input
                  type="text"
                  value={draftDoc.meta?.docNumber ?? ""}
                  onChange={(e) =>
                    setDraftDoc((prev) =>
                      prev
                        ? {
                            ...prev,
                            meta: { ...prev.meta, docNumber: e.target.value },
                          }
                        : prev
                    )
                  }
                  className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1 text-xs"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-500">
                  Data documento
                </label>
                <input
                  type="date"
                  value={draftDoc.meta?.docDate ?? ""}
                  onChange={(e) =>
                    setDraftDoc((prev) =>
                      prev
                        ? {
                            ...prev,
                            meta: { ...prev.meta, docDate: e.target.value },
                          }
                        : prev
                    )
                  }
                  className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1 text-xs"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-500">
                  Incoterm
                </label>
                <input
                  type="text"
                  value={draftDoc.meta?.incoterm ?? ""}
                  onChange={(e) =>
                    setDraftDoc((prev) =>
                      prev
                        ? {
                            ...prev,
                            meta: { ...prev.meta, incoterm: e.target.value },
                          }
                        : prev
                    )
                  }
                  className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1 text-xs"
                />
              </div>
            </div>

            {/* Parties */}
            <div className="mb-4 grid gap-3 md:grid-cols-3">
              <div>
                <label className="block text-[11px] font-medium text-slate-500">
                  Seller (nome)
                </label>
                <input
                  type="text"
                  value={draftDoc.parties?.shipper?.name ?? ""}
                  onChange={(e) =>
                    setDraftDoc((prev) => {
                      if (!prev) return prev;
                      const prevParties = prev.parties || {};
                      const prevShipper = prevParties.shipper || {};
                      return {
                        ...prev,
                        parties: {
                          ...prevParties,
                          shipper: {
                            ...prevShipper,
                            name: e.target.value,
                          },
                        },
                      };
                    })
                  }
                  className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1 text-xs"
                />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-slate-500">
                  Buyer (nome)
                </label>
                <input
                  type="text"
                  value={draftDoc.parties?.consignee?.name ?? ""}
                  onChange={(e) =>
                    setDraftDoc((prev) => {
                      if (!prev) return prev;
                      const prevParties = prev.parties || {};
                      const prevConsignee = prevParties.consignee || {};
                      return {
                        ...prev,
                        parties: {
                          ...prevParties,
                          consignee: {
                            ...prevConsignee,
                            name: e.target.value,
                          },
                        },
                      };
                    })
                  }
                  className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1 text-xs"
                />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-slate-500">
                  Bill to (nome)
                </label>
                <input
                  type="text"
                  value={draftDoc.parties?.billTo?.name ?? ""}
                  onChange={(e) =>
                    setDraftDoc((prev) => {
                      if (!prev) return prev;
                      const prevParties = prev.parties || {};
                      const prevBillTo = prevParties.billTo || {};
                      return {
                        ...prev,
                        parties: {
                          ...prevParties,
                          billTo: {
                            ...prevBillTo,
                            name: e.target.value,
                          },
                        },
                      };
                    })
                  }
                  className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1 text-xs"
                />
              </div>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={async () => {
                  if (!draftDoc) return;
                  try {
                    const res = await fetch(
                      "/api/utility-documenti/genera",
                      {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          doc_type:
                            draftDoc.meta?.docType ??
                            docType ??
                            "fattura_proforma",
                          doc_data: draftDoc,
                        }),
                      }
                    );
                    const json = await res.json().catch(() => ({}));
                    if (!res.ok || !json?.ok) {
                      throw new Error(
                        json?.error ||
                          json?.details ||
                          `Errore ${res.status} nel rendering documento`
                      );
                    }
                    // Aggiorniamo sia doc che html
                    if (json.doc) {
                      setDraftDoc(json.doc);
                      setDebugPayload(json.doc);
                      setBaseDoc(json.doc);
                    } else {
                      setDebugPayload(json);
                    }
                    setPreviewHtml(json.html || null);
                  } catch (e: any) {
                    console.error(
                      "[utility-documenti] render doc error:",
                      e
                    );
                    alert(
                      e?.message || "Errore nel rendering del documento"
                    );
                  }
                }}
                className="rounded-md bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800"
              >
                Aggiorna anteprima
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
                Reset dai dati spedizione
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
