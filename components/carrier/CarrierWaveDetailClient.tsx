"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ExternalLink,
  FileText,
  Loader2,
  MapPin,
} from "lucide-react";

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
      // ✅ campi REALI (più tolleranza)
      mittente?: string | null;
      mittente_ragione_sociale?: string | null;

      mittente_indirizzo?: string | null;
      mittente_citta?: string | null;
      mittente_cap?: string | null;
      mittente_telefono?: string | null;

      destinatario?: string | null;
      destinatario_ragione_sociale?: string | null;
      destinatario_indirizzo?: string | null;
      destinatario_citta?: string | null;
      destinatario_cap?: string | null;
      destinatario_paese?: string | null;
      destinatario_telefono?: string | null;

      declared_value?: number | null;
      fatt_valuta?: string | null;

      ldv?: string | null;
      note_ritiro?: string | null;
      packages?: Array<{
        id: string;
        length_cm?: number | null;
        width_cm?: number | null;
        height_cm?: number | null;
        weight_kg?: number | null;
        contenuto?: string | null;
      }> | null;
    } | null;
  }>;
};

function cn(...a: Array<string | false | null | undefined>) {
  return a.filter(Boolean).join(" ");
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { cache: "no-store", ...init });
  if (!res.ok) {
    const err = await res.json().catch(() => null);
    throw new Error(`[${res.status}] ${url} ${err ? JSON.stringify(err) : ""}`);
  }
  return (await res.json()) as T;
}

function statusPill(status?: string | null) {
  const s = (status ?? "").toLowerCase();
  const base =
    "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium";
  if (s === "bozza") return cn(base, "bg-slate-100 text-slate-700");
  if (s === "inviata") return cn(base, "bg-blue-100 text-blue-700");
  if (s === "in_corso") return cn(base, "bg-amber-100 text-amber-700");
  if (s === "completata") return cn(base, "bg-emerald-100 text-emerald-700");
  if (s === "annullata") return cn(base, "bg-rose-100 text-rose-700");
  return cn(base, "bg-slate-100 text-slate-700");
}

function fmtDate(x?: string | null) {
  return x || "—";
}

export default function CarrierWaveDetailClient({ waveId }: { waveId: string }) {
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

  const missingDdt = useMemo(() => {
    let n = 0;
    for (const it of items) {
      const ldv = it.shipments?.ldv;
      if (!ldv) n += 1;
    }
    return n;
  }, [items]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-2">
          <Link
            href="/carrier/waves"
            className="inline-flex h-10 items-center justify-center rounded-xl border bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Indietro
          </Link>

          <Link
            href={`/carrier/waves/${waveId}/print`}
            className="inline-flex h-10 items-center justify-center rounded-xl border bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            <ExternalLink className="mr-2 h-4 w-4" />
            Print view
          </Link>
        </div>

        <button
          onClick={() => void load()}
          className="inline-flex h-10 items-center justify-center rounded-xl border bg-white px-4 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          Ricarica
        </button>
      </div>

      <div className="rounded-2xl border bg-white p-4 shadow-sm">
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-slate-600">
            <Loader2 className="h-4 w-4 animate-spin" /> Caricamento wave…
          </div>
        ) : err ? (
          <div className="text-sm text-rose-700">Errore: {err}</div>
        ) : !wave ? (
          <div className="text-sm text-slate-600">Wave non trovata.</div>
        ) : (
          <div className="space-y-2">
            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <div className="flex items-center gap-2">
                <div className="text-base font-semibold text-slate-900">
                  {wave.code}
                </div>
                <span className={statusPill(wave.status)}>{wave.status}</span>
              </div>
              <div className="text-xs text-slate-600">
                Carrier:{" "}
                <span className="font-medium text-slate-800">
                  {wave.carriers?.name ?? "—"}
                </span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-sm text-slate-700">
              <div>
                Data wave:{" "}
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
              <div>
                DDT mancanti:{" "}
                <span
                  className={cn(
                    "font-medium",
                    missingDdt > 0 ? "text-rose-700" : "text-emerald-700"
                  )}
                >
                  {missingDdt}
                </span>
              </div>
            </div>

            {wave.notes ? (
              <div className="text-sm text-slate-600">{wave.notes}</div>
            ) : null}
          </div>
        )}
      </div>

      <div className="rounded-2xl border bg-white shadow-sm">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <div className="text-sm font-semibold text-slate-900">
            Ritiri ({items.length})
          </div>
        </div>

        <div className="divide-y">
          {items.map((it) => {
            const s = it.shipments ?? null;
            const ldv = s?.ldv ?? null;

            const mittenteName =
              s?.mittente_ragione_sociale ?? s?.mittente ?? null;

            const destName =
              s?.destinatario_ragione_sociale ?? s?.destinatario ?? null;

            const mittenteLine = [
              mittenteName,
              s?.mittente_indirizzo,
              [s?.mittente_cap, s?.mittente_citta].filter(Boolean).join(" "),
            ]
              .filter(Boolean)
              .join(" • ");

            const destLine = [
              destName,
              [
                s?.destinatario_indirizzo,
                [s?.destinatario_cap, s?.destinatario_citta].filter(Boolean).join(" "),
                s?.destinatario_paese,
              ]
                .filter(Boolean)
                .join(" • "),
            ]
              .filter(Boolean)
              .join(" — ");

            const human = it.shipment_human_id || null;
            const packages = s?.packages ?? [];
            const declaredValue = s?.declared_value ?? null;
            const valuta = s?.fatt_valuta ?? "EUR";

            return (
              <div key={it.shipment_id} className="px-4 py-4">
                <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                  <div className="flex-1 space-y-1">
                    <div className="text-sm font-semibold text-slate-900">
                      {human ?? it.shipment_id}
                    </div>

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600">
                      <span className="inline-flex items-center gap-1">
                        <MapPin className="h-3.5 w-3.5" />
                        {mittenteLine || "Mittente —"}
                      </span>
                      {s?.mittente_telefono ? (
                        <span>Tel: {s.mittente_telefono}</span>
                      ) : null}
                    </div>

                    {destLine ? (
                      <div className="text-xs text-slate-500">
                        Dest: {destLine}
                        {s?.destinatario_telefono ? (
                          <span className="ml-2">Tel: {s.destinatario_telefono}</span>
                        ) : null}
                      </div>
                    ) : null}

                    <div className="text-xs text-slate-500">
                      Richiesto: {fmtDate(it.requested_pickup_date)} • Pianificato:{" "}
                      {fmtDate(it.planned_pickup_date)}
                    </div>

                    {s?.note_ritiro ? (
                      <div className="text-xs text-slate-500">
                        Note ritiro: {s.note_ritiro}
                      </div>
                    ) : null}

                    {/* Dettagli Pallet */}
                    {(packages.length > 0 || declaredValue != null) && (
                      <div className="mt-3 rounded-xl bg-slate-50 p-3">
                        {packages.length > 0 && (
                          <div className="mb-2">
                            <div className="mb-2 text-xs font-semibold text-slate-700">
                              Dettagli Pallet ({packages.length})
                            </div>
                            <div className="space-y-1">
                              {packages.map((pkg, idx) => {
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
                                    <span className="font-medium">#{idx + 1}</span>{" "}
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
                            <span className="font-semibold">Valore assicurato:</span>{" "}
                            <span className="text-slate-600">
                              {declaredValue.toLocaleString("it-IT", {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              })}{" "}
                              {valuta}
                            </span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    {ldv ? (
                      <a
                        href={ldv}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex h-9 items-center justify-center rounded-xl bg-slate-900 px-3 text-sm font-medium text-white hover:bg-slate-800"
                      >
                        <FileText className="mr-2 h-4 w-4" />
                        DDT
                      </a>
                    ) : (
                      <span className="inline-flex h-9 items-center justify-center rounded-xl border bg-white px-3 text-sm font-medium text-slate-500">
                        DDT assente
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}

          {!loading && !err && items.length === 0 ? (
            <div className="px-4 py-8 text-sm text-slate-600">
              Nessun item in questa wave.
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
