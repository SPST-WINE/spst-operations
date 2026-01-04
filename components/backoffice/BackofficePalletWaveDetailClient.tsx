// components/backoffice/BackofficePalletWaveDetailClient.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ExternalLink, Loader2, Truck, FileText, ArrowLeft } from "lucide-react";

type WaveDetail = {
  id: string;
  code: string;
  status: string;
  planned_pickup_date: string | null;
  pickup_window: string | null;
  notes: string | null;
  carriers?: { name?: string | null } | null;
  pallet_wave_items: Array<{
    shipment_id: string;
    shipment_human_id: string | null;
    requested_pickup_date: string | null;
    planned_pickup_date: string | null;
    shipments?: {
      mittente_rs?: string | null;
      mittente_indirizzo?: string | null;
      mittente_citta?: string | null;
      mittente_cap?: string | null;
      mittente_telefono?: string | null;

      dest_rs?: string | null;
      dest_citta?: string | null;
      dest_paese?: string | null;
      dest_telefono?: string | null;

      declared_value?: number | null;
      fatt_valuta?: string | null;

      ldv?: string | null;
      packages?: Array<{
        id: string;
        length_cm?: number | null;
        width_cm?: number | null;
        height_cm?: number | null;
        weight_kg?: number | null;
        contenuto?: string | null;
      }> | null;
    };
  }>;
};

function cn(...a: Array<string | false | null | undefined>) {
  return a.filter(Boolean).join(" ");
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    const err = await res.json().catch(() => null);
    throw new Error(`[${res.status}] ${url} ${err ? JSON.stringify(err) : ""}`);
  }
  return (await res.json()) as T;
}

function formatDate(x?: string | null) {
  return x ? x : "—";
}

function statusPill(status?: string | null) {
  const s = (status ?? "").toLowerCase();
  const base =
    "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium uppercase";
  if (s === "bozza") return cn(base, "bg-slate-100 text-slate-700");
  if (s === "inviata") return cn(base, "bg-blue-100 text-blue-700");
  if (s === "in_corso") return cn(base, "bg-amber-100 text-amber-700");
  if (s === "completata") return cn(base, "bg-emerald-100 text-emerald-700");
  if (s === "annullata") return cn(base, "bg-rose-100 text-rose-700");
  return cn(base, "bg-slate-100 text-slate-700");
}

export default function BackofficePalletWaveDetailClient({
  waveId,
}: {
  waveId: string;
}) {
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [wave, setWave] = useState<WaveDetail | null>(null);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [cancelText, setCancelText] = useState("");

  async function load() {
    setLoading(true);
    setErr(null);
    try {
      // ✅ backoffice staff-only route (service role, bypass RLS)
      const res = await fetchJson<{ wave: WaveDetail }>(
        `/api/backoffice/pallets/waves/${encodeURIComponent(waveId)}`
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

  const items = wave?.pallet_wave_items ?? [];

  const stats = useMemo(() => {
    let ddtOk = 0;
    let ddtMissing = 0;
    for (const it of items) {
      const has = Boolean(it.shipments?.ldv);
      if (has) ddtOk += 1;
      else ddtMissing += 1;
    }
    return { shipments: items.length, ddtOk, ddtMissing };
  }, [items]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-slate-600">
        <Loader2 className="h-4 w-4 animate-spin" /> Caricamento…
      </div>
    );
  }

  if (err) {
    return (
      <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
        <div className="font-semibold">Errore</div>
        <div className="mt-1 break-words text-xs">{err}</div>
        <button
          onClick={() => void load()}
          className="mt-3 inline-flex items-center rounded-xl bg-rose-700 px-3 py-2 text-xs font-semibold text-white hover:bg-rose-600"
        >
          Riprova
        </button>
      </div>
    );
  }

  if (!wave) {
    return (
      <div className="rounded-2xl border bg-white p-4 text-sm text-slate-700">
        Wave non trovata.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="rounded-2xl border bg-white p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <Link
              href="/back-office/pallet"
              className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-slate-700 hover:text-slate-900"
            >
              <ArrowLeft className="h-4 w-4" /> Indietro
            </Link>

            <div>
              <div className="flex flex-wrap items-center gap-2">
                <Truck className="h-4 w-4 text-slate-700" />
                <h2 className="text-sm font-semibold text-slate-900">
                  {wave.code}
                </h2>
                <span className={statusPill(wave.status)}>{wave.status}</span>
              </div>

              <div className="mt-2 grid grid-cols-1 gap-3 text-xs text-slate-600 sm:grid-cols-3">
                <div className="rounded-xl bg-slate-50 p-3">
                  <div className="text-[11px] text-slate-500">Trasportatore</div>
                  <div className="mt-1 font-semibold text-slate-900">
                    {wave.carriers?.name ?? "—"}
                  </div>
                </div>

                <div className="rounded-xl bg-slate-50 p-3">
                  <div className="text-[11px] text-slate-500">Ritiro wave</div>
                  <div className="mt-1 font-semibold text-slate-900">
                    {formatDate(wave.planned_pickup_date)}
                  </div>
                  <div className="mt-1 text-[11px] text-slate-500">
                    Finestra: {wave.pickup_window ?? "—"}
                  </div>
                </div>

                <div className="rounded-xl bg-slate-50 p-3">
                  <div className="text-[11px] text-slate-500">Spedizioni</div>
                  <div className="mt-1 font-semibold text-slate-900">
                    {stats.shipments}
                  </div>
                  <div className="mt-1 text-[11px] text-slate-500">
                    DDT OK: {stats.ddtOk} · Mancanti: {stats.ddtMissing}
                  </div>
                </div>
              </div>

              {wave.notes ? (
                <div className="mt-3 text-xs text-slate-600">
                  <span className="font-semibold text-slate-700">Note:</span>{" "}
                  {wave.notes}
                </div>
              ) : null}
            </div>
          </div>

          <button
            onClick={() => void load()}
            className="text-xs font-medium text-slate-600 hover:text-slate-900"
          >
            Aggiorna
          </button>
        </div>
      </div>

      {/* Action buttons card */}
      <div className="rounded-2xl border bg-white p-4">
        <div className="space-y-4">
          {/* Invia wave (BOZZA -> INVIATA) */}
          {(wave.status || "").toLowerCase() === "bozza" && (
            <div>
              <button
                onClick={async () => {
                  setUpdatingStatus(true);
                  try {
                    const res = await fetch(`/api/backoffice/pallets/waves/${encodeURIComponent(waveId)}/status`, {
                      method: "PATCH",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ status: "inviata" }),
                    });
                    if (!res.ok) throw new Error("Failed to update status");
                    await load();
                  } catch (e: any) {
                    setErr(String(e?.message ?? e));
                  } finally {
                    setUpdatingStatus(false);
                  }
                }}
                disabled={updatingStatus}
                className="inline-flex items-center rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {updatingStatus ? "Invio in corso..." : "Invia wave"}
              </button>
            </div>
          )}

          {/* Segna come consegnata (IN CORSO -> COMPLETATA) */}
          {(wave.status || "").toLowerCase() === "in_corso" && (
            <div>
              <button
                onClick={async () => {
                  setUpdatingStatus(true);
                  try {
                    const res = await fetch(`/api/backoffice/pallets/waves/${encodeURIComponent(waveId)}/status`, {
                      method: "PATCH",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ status: "completata" }),
                    });
                    if (!res.ok) throw new Error("Failed to update status");
                    await load();
                  } catch (e: any) {
                    setErr(String(e?.message ?? e));
                  } finally {
                    setUpdatingStatus(false);
                  }
                }}
                disabled={updatingStatus}
                className="inline-flex items-center rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                {updatingStatus ? "Aggiornamento..." : "Segna come consegnata"}
              </button>
            </div>
          )}

          {/* Annulla wave */}
          {["bozza", "inviata", "in_corso"].includes((wave.status || "").toLowerCase()) && (
            <div className="space-y-2">
              <div className="text-sm font-semibold text-slate-900">Annulla wave</div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={cancelText}
                  onChange={(e) => setCancelText(e.target.value)}
                  placeholder="voglio annullare la wave"
                  className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-rose-500 focus:outline-none focus:ring-2 focus:ring-rose-200"
                />
                <button
                  onClick={async () => {
                    if (cancelText.trim() !== "voglio annullare la wave") return;
                    setUpdatingStatus(true);
                    try {
                      const res = await fetch(`/api/backoffice/pallets/waves/${encodeURIComponent(waveId)}/status`, {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ status: "annullata" }),
                      });
                      if (!res.ok) throw new Error("Failed to update status");
                      setCancelText("");
                      await load();
                    } catch (e: any) {
                      setErr(String(e?.message ?? e));
                    } finally {
                      setUpdatingStatus(false);
                    }
                  }}
                  disabled={updatingStatus || cancelText.trim() !== "voglio annullare la wave"}
                  className="inline-flex items-center rounded-xl bg-rose-600 px-4 py-2 text-sm font-medium text-white hover:bg-rose-700 disabled:opacity-50"
                >
                  {updatingStatus ? "Annullamento..." : "Annulla wave"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Items table */}
      <div className="rounded-2xl border bg-white">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <div>
            <div className="text-sm font-semibold text-slate-900">
              Ritiri in wave
            </div>
            <div className="text-xs text-slate-500">
              Elenco spedizioni incluse, con dati operativi e link DDT.
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs text-slate-600">
              <tr>
                <th className="px-4 py-3">Spedizione</th>
                <th className="px-4 py-3">Mittente</th>
                <th className="px-4 py-3">Destinatario</th>
                <th className="px-4 py-3">Ritiro richiesto</th>
                <th className="px-4 py-3">Ritiro wave</th>
                <th className="px-4 py-3">DDT</th>
              </tr>
            </thead>

            <tbody className="divide-y">
              {items.flatMap((it) => {
                const sh = it.shipments;
                const ddt = sh?.ldv ?? null;
                const human = it.shipment_human_id ?? "—";
                const toShipmentHref =
                  human !== "—"
                    ? `/back-office/spedizioni/${encodeURIComponent(human)}`
                    : null;
                const packages = sh?.packages ?? [];
                const declaredValue = sh?.declared_value ?? null;
                const valuta = sh?.fatt_valuta ?? "EUR";

                const rows = [
                  <tr key={it.shipment_id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-slate-900">
                          {human}
                        </span>

                        {toShipmentHref ? (
                          <Link
                            href={toShipmentHref}
                            className="inline-flex items-center gap-1 text-xs text-slate-600 hover:text-slate-900"
                          >
                            Apri <ExternalLink className="h-3 w-3" />
                          </Link>
                        ) : null}
                      </div>
                      <div className="mt-1 text-[11px] text-slate-500">
                        ID: {it.shipment_id.slice(0, 8)}…
                      </div>
                    </td>

                    <td className="px-4 py-3">
                      <div className="text-sm text-slate-800">
                        {sh?.mittente_rs ?? "—"}
                      </div>
                      <div className="mt-1 text-[11px] text-slate-500">
                        {[
                          sh?.mittente_indirizzo,
                          sh?.mittente_citta,
                          sh?.mittente_cap,
                        ]
                          .filter(Boolean)
                          .join(", ") || "—"}
                      </div>
                      {sh?.mittente_telefono ? (
                        <div className="mt-1 text-[11px] text-slate-500">
                          Tel: {sh.mittente_telefono}
                        </div>
                      ) : null}
                    </td>

                    <td className="px-4 py-3">
                      <div className="text-sm text-slate-800">
                        {sh?.dest_rs ?? "—"}
                      </div>
                      <div className="mt-1 text-[11px] text-slate-500">
                        {[sh?.dest_citta, sh?.dest_paese]
                          .filter(Boolean)
                          .join(", ") || "—"}
                      </div>
                      {sh?.dest_telefono ? (
                        <div className="mt-1 text-[11px] text-slate-500">
                          Tel: {sh.dest_telefono}
                        </div>
                      ) : null}
                    </td>

                    <td className="px-4 py-3 text-slate-800">
                      {formatDate(it.requested_pickup_date)}
                    </td>

                    <td className="px-4 py-3 text-slate-800">
                      {formatDate(it.planned_pickup_date)}
                    </td>

                    <td className="px-4 py-3">
                      {ddt ? (
                        <a
                          href={ddt}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 rounded-xl bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-800"
                        >
                          <FileText className="h-4 w-4" /> Scarica DDT
                        </a>
                      ) : (
                        <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                          Mancante
                        </span>
                      )}
                    </td>
                  </tr>,
                ];

                if (packages.length > 0 || declaredValue != null) {
                  rows.push(
                    <tr key={`${it.shipment_id}-details`} className="bg-slate-50">
                      <td colSpan={6} className="px-4 py-3">
                        <div className="space-y-3">
                          {packages.length > 0 && (
                            <div>
                              <div className="mb-2 text-xs font-semibold text-slate-700">
                                Dettagli Pallet ({packages.length})
                              </div>
                              <div className="overflow-x-auto rounded-xl bg-white">
                                <table className="min-w-full text-xs">
                                  <thead className="bg-slate-100 text-[11px] text-slate-600">
                                    <tr>
                                      <th className="px-3 py-2 text-left">#</th>
                                      <th className="px-3 py-2 text-left">Dimensioni (cm)</th>
                                      <th className="px-3 py-2 text-left">Peso (kg)</th>
                                      <th className="px-3 py-2 text-left">Contenuto</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-slate-100">
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
                                        <tr key={pkg.id}>
                                          <td className="px-3 py-2 font-medium text-slate-700">
                                            {idx + 1}
                                          </td>
                                          <td className="px-3 py-2 text-slate-600">
                                            {dims || "—"}
                                          </td>
                                          <td className="px-3 py-2 text-slate-600">
                                            {pkg.weight_kg != null
                                              ? `${pkg.weight_kg.toLocaleString("it-IT", {
                                                  minimumFractionDigits: 2,
                                                  maximumFractionDigits: 2,
                                                })}`
                                              : "—"}
                                          </td>
                                          <td className="px-3 py-2 text-slate-600">
                                            {pkg.contenuto || "—"}
                                          </td>
                                        </tr>
                                      );
                                    })}
                                  </tbody>
                                </table>
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
                      </td>
                    </tr>
                  );
                }

                return rows;
              })}

              {items.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-10 text-center text-sm text-slate-500"
                  >
                    Nessuna spedizione in wave.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      {/* Notes / Next steps */}
      <div className="rounded-2xl border bg-white p-4">
        <div className="text-sm font-semibold text-slate-900">
          Nota operativa (MVP)
        </div>
        <div className="mt-2 text-xs text-slate-600">
          Il trasportatore in questa fase lavora su:{" "}
          <strong>ritiri + DDT</strong>. Gli update di stato avanzati (foto,
          firma, POD) verranno introdotti solo con versioning e permessi
          aggiuntivi.
        </div>
      </div>
    </div>
  );
}
