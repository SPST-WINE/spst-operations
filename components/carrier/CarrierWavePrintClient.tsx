"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Loader2, Printer } from "lucide-react";

type WaveDetail = {
  id: string;
  code: string;
  status: string;
  planned_pickup_date: string | null;
  pickup_window: string | null;
  notes: string | null;
  carriers?: { name?: string | null } | null;
  pallet_wave_items?: Array<{
    shipment_id: string;
    shipment_human_id: string | null;
    requested_pickup_date: string | null;
    planned_pickup_date: string | null;
    shipments?: {
      mittente_ragione_sociale: string | null;
      mittente_indirizzo: string | null;
      mittente_citta: string | null;
      mittente_cap: string | null;
      mittente_telefono: string | null;

      destinatario_ragione_sociale: string | null;
      destinatario_indirizzo: string | null;
      destinatario_citta: string | null;
      destinatario_cap: string | null;
      destinatario_paese: string | null;
      destinatario_telefono: string | null;

      declared_value: number | null;
      fatt_valuta: string | null;

      ldv: string | null;
      note_ritiro: string | null;
      packages?: Array<{
        id: string;
        length_cm: number | null;
        width_cm: number | null;
        height_cm: number | null;
        weight_kg: number | null;
        contenuto: string | null;
      }> | null;
    } | null;
  }>;
};

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { cache: "no-store", ...init });
  if (!res.ok) {
    const err = await res.json().catch(() => null);
    throw new Error(`[${res.status}] ${url} ${err ? JSON.stringify(err) : ""}`);
  }
  return (await res.json()) as T;
}

function fmtDate(x?: string | null) {
  return x || "—";
}

export default function CarrierWavePrintClient({ waveId }: { waveId: string }) {
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [wave, setWave] = useState<WaveDetail | null>(null);

  async function load() {
    setLoading(true);
    setErr(null);
    try {
      const res = await fetchJson<{ wave: WaveDetail }>(
        `/api/pallets/waves/${encodeURIComponent(waveId)}`
      );
      setWave(res.wave ?? null);
    } catch (e: any) {
      setErr(String(e?.message ?? e));
      setWave(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [waveId]);

  const items = useMemo(() => wave?.pallet_wave_items ?? [], [wave]);

  return (
    <div className="bg-white">
      {/* Top bar (non stampabile) */}
      <div className="print:hidden border-b bg-slate-50">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <Link
              href={`/carrier/waves/${waveId}`}
              className="inline-flex h-10 items-center justify-center rounded-xl border bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Indietro
            </Link>
          </div>

          <button
            onClick={() => window.print()}
            className="inline-flex h-10 items-center justify-center rounded-xl bg-slate-900 px-4 text-sm font-medium text-white hover:bg-slate-800"
          >
            <Printer className="mr-2 h-4 w-4" />
            Stampa
          </button>
        </div>
      </div>

      <div className="mx-auto max-w-5xl px-4 py-6">
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-slate-600">
            <Loader2 className="h-4 w-4 animate-spin" /> Caricamento…
          </div>
        ) : err ? (
          <div className="text-sm text-rose-700">Errore: {err}</div>
        ) : !wave ? (
          <div className="text-sm text-slate-600">Wave non trovata.</div>
        ) : (
          <>
            <div className="mb-6">
              <div className="text-xs text-slate-500">SPST • Print view</div>
              <div className="text-xl font-semibold text-slate-900">
                {wave.code}
              </div>
              <div className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-sm text-slate-700">
                <div>
                  Carrier:{" "}
                  <span className="font-medium">
                    {wave.carriers?.name ?? "—"}
                  </span>
                </div>
                <div>
                  Data:{" "}
                  <span className="font-medium">
                    {fmtDate(wave.planned_pickup_date)}
                  </span>
                </div>
                <div>
                  Finestra:{" "}
                  <span className="font-medium">{wave.pickup_window || "—"}</span>
                </div>
                <div>
                  Ritiri: <span className="font-medium">{items.length}</span>
                </div>
              </div>
              {wave.notes ? (
                <div className="mt-2 text-sm text-slate-600">{wave.notes}</div>
              ) : null}
            </div>

            <div className="space-y-3">
              {items.map((it, idx) => {
                const s = it.shipments;
                const mittente = [
                  s?.mittente_ragione_sociale,
                  s?.mittente_indirizzo,
                  [s?.mittente_cap, s?.mittente_citta].filter(Boolean).join(" "),
                ]
                  .filter(Boolean)
                  .join(" • ");

                const dest = [
                  s?.destinatario_ragione_sociale,
                  s?.destinatario_indirizzo,
                  [
                    s?.destinatario_cap,
                    s?.destinatario_citta,
                    s?.destinatario_paese,
                  ]
                    .filter(Boolean)
                    .join(" • "),
                ]
                  .filter(Boolean)
                  .join(" — ");

                const packages = s?.packages ?? [];
                const declaredValue = s?.declared_value ?? null;
                const valuta = s?.fatt_valuta ?? "EUR";

                return (
                  <div
                    key={it.shipment_id}
                    className="rounded-xl border p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-semibold text-slate-900">
                          {idx + 1}. {it.shipment_human_id || it.shipment_id}
                        </div>
                        <div className="mt-1 text-sm text-slate-800">
                          <span className="font-medium">Mittente:</span>{" "}
                          {mittente || "—"}
                        </div>
                        {s?.mittente_telefono ? (
                          <div className="text-sm text-slate-800">
                            <span className="font-medium">Tel:</span>{" "}
                            {s.mittente_telefono}
                          </div>
                        ) : null}
                        {dest ? (
                          <div className="mt-1 text-sm text-slate-700">
                            <span className="font-medium">Destinatario:</span>{" "}
                            {dest}
                          </div>
                        ) : null}
                        {s?.destinatario_telefono ? (
                          <div className="text-sm text-slate-700">
                            <span className="font-medium">Tel:</span>{" "}
                            {s.destinatario_telefono}
                          </div>
                        ) : null}
                        <div className="mt-1 text-xs text-slate-500">
                          Richiesto: {fmtDate(it.requested_pickup_date)} •
                          Pianificato: {fmtDate(it.planned_pickup_date)}
                        </div>
                        {s?.note_ritiro ? (
                          <div className="mt-1 text-xs text-slate-500">
                            <span className="font-medium">Note ritiro:</span>{" "}
                            {s.note_ritiro}
                          </div>
                        ) : null}

                        {/* Dettagli Pallet */}
                        {(packages.length > 0 || declaredValue != null) && (
                          <div className="mt-2 rounded-lg bg-slate-50 p-2">
                            {packages.length > 0 && (
                              <div className="mb-2">
                                <div className="text-xs font-semibold text-slate-700">
                                  Pallet ({packages.length})
                                </div>
                                <div className="mt-1 space-y-0.5">
                                  {packages.map((pkg, pkgIdx) => {
                                    const dims = [
                                      pkg.length_cm,
                                      pkg.width_cm,
                                      pkg.height_cm,
                                    ]
                                      .filter((d) => d != null)
                                      .map((d) => `${d}`)
                                      .join(" × ");
                                    return (
                                      <div key={pkg.id} className="text-xs text-slate-600">
                                        #{pkgIdx + 1}{" "}
                                        {dims ? `Dim: ${dims} cm` : ""}
                                        {pkg.weight_kg != null
                                          ? ` • Peso: ${pkg.weight_kg.toLocaleString("it-IT", {
                                              minimumFractionDigits: 2,
                                              maximumFractionDigits: 2,
                                            })} kg`
                                          : ""}
                                        {pkg.contenuto ? ` • ${pkg.contenuto}` : ""}
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            )}
                            {declaredValue != null && (
                              <div className="text-xs text-slate-700">
                                <span className="font-semibold">Assicurazione:</span>{" "}
                                {declaredValue.toLocaleString("it-IT", {
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: 2,
                                })}{" "}
                                {valuta}
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      <div className="shrink-0 text-right">
                        {(() => {
                          const ldvRaw = s?.ldv;
                          let ldvUrl: string | null = null;
                          if (typeof ldvRaw === "string") {
                            ldvUrl = ldvRaw;
                          } else if (ldvRaw && typeof ldvRaw === "object" && "url" in ldvRaw) {
                            const ldvObj = ldvRaw as { url?: string | null };
                            if (typeof ldvObj.url === "string") {
                              ldvUrl = ldvObj.url;
                            }
                          }
                          
                          return ldvUrl ? (
                            <div className="text-xs text-slate-500">
                              DDT: {ldvUrl}
                            </div>
                          ) : (
                            <div className="text-xs text-rose-700">
                              DDT assente
                            </div>
                          );
                        })()}
                      </div>
                    </div>
                  </div>
                );
              })}

              {items.length === 0 ? (
                <div className="text-sm text-slate-600">
                  Nessun item in questa wave.
                </div>
              ) : null}
            </div>

            <div className="mt-8 text-xs text-slate-500">
              Nota: i link DDT sono stampati come testo per affidabilità in
              stampa. (MVP)
            </div>
          </>
        )}
      </div>
    </div>
  );
}
