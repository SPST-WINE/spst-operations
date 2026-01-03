"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Boxes,
  Calendar,
  CheckCircle2,
  ExternalLink,
  Loader2,
  Package,
  Truck,
} from "lucide-react";

type PalletPoolItem = {
  shipment_id: string;
  human_id: string;
  mittente_cap: string | null;
  mittente_citta: string | null;
  giorno_ritiro: string | null;
  pallet_count: number;
  has_ddt: boolean;
};

type CarrierItem = {
  id: string;
  name: string;
};

type WaveListItem = {
  id: string;
  code: string;
  status: string;
  planned_pickup_date: string | null;
  pickup_window: string | null;
  notes: string | null;
  created_at: string;
  carriers?: { name?: string | null } | null;
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

function formatDate(x?: string | null) {
  if (!x) return "—";
  return x;
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

export default function BackofficePalletClient() {
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [pool, setPool] = useState<PalletPoolItem[]>([]);
  const [waves, setWaves] = useState<WaveListItem[]>([]);
  const [carriers, setCarriers] = useState<CarrierItem[]>([]);

  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const selectedIds = useMemo(
    () => Object.entries(selected).filter(([, v]) => v).map(([k]) => k),
    [selected]
  );

  const selectedStats = useMemo(() => {
    const map = new Map(pool.map((p) => [p.shipment_id, p] as const));
    let pallets = 0;
    let missingDdt = 0;
    for (const id of selectedIds) {
      const it = map.get(id);
      if (!it) continue;
      pallets += Number(it.pallet_count || 0);
      if (!it.has_ddt) missingDdt += 1;
    }
    return { pallets, shipments: selectedIds.length, missingDdt };
  }, [pool, selectedIds]);

  const todayIso = useMemo(() => {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }, []);

  const [carrierId, setCarrierId] = useState<string>("");
  const [plannedDate, setPlannedDate] = useState<string>(todayIso);
  const [pickupWindow, setPickupWindow] = useState<string>("09:00-18:00");
  const [notes, setNotes] = useState<string>("");
  const [creating, setCreating] = useState(false);

  async function loadAll() {
    setLoading(true);
    setErr(null);
    try {
      const poolRes = await fetchJson<{ items: PalletPoolItem[] }>(
        "/api/pallets/pool"
      );
      setPool(poolRes.items ?? []);

      // carriers
      try {
        const c = await fetchJson<{ items: CarrierItem[] }>(
          "/api/pallets/carriers"
        );
        setCarriers(c.items ?? []);
        if (!carrierId && (c.items?.length ?? 0) > 0) {
          // Default: first carrier (MVP = SDF)
          setCarrierId(c.items[0].id);
        }
      } catch {
        // If carriers endpoint is not present, allow manual input
        setCarriers([]);
      }

      // waves list (backoffice staff-only)
      // ⚠️ NON usare /api/pallets/waves qui: è shared + RLS (carrier), quindi da staff può risultare vuoto.
      let wavesRes: { items: WaveListItem[] } = { items: [] };
      try {
        wavesRes = await fetchJson<{ items: WaveListItem[] }>(
          "/api/backoffice/pallets/waves"
        );
      } catch {
        // fallback: non blocchiamo tutto il pannello se la lista waves fallisce
        wavesRes = { items: [] };
      }

      setWaves(wavesRes.items ?? []);
    } catch (e: any) {
      setErr(String(e?.message ?? e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function createWave() {
    if (creating) return;
    setErr(null);

    if (!carrierId) {
      setErr("Seleziona un trasportatore (carrier_id).");
      return;
    }
    if (selectedStats.pallets < 6) {
      setErr("Una WAVE deve contenere almeno 6 pallet totali.");
      return;
    }

    setCreating(true);
    try {
      await fetchJson<{ wave_id: string }>("/api/pallets/waves", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shipment_ids: selectedIds,
          planned_pickup_date: plannedDate,
          pickup_window: pickupWindow,
          notes: notes || null,
          carrier_id: carrierId,
        }),
      });

      setSelected({});
      setNotes("");
      await loadAll();
    } catch (e: any) {
      setErr(String(e?.message ?? e));
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Top controls */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border bg-white p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Boxes className="h-4 w-4 text-slate-700" />
              <h2 className="text-sm font-semibold text-slate-900">
                Pool pallet Campania
              </h2>
            </div>
            <button
              onClick={() => void loadAll()}
              className="text-xs font-medium text-slate-600 hover:text-slate-900"
            >
              Aggiorna
            </button>
          </div>

          <p className="mt-2 text-xs text-slate-600">
            Seleziona le spedizioni e crea una <strong>WAVE</strong> quando il
            totale pallet è almeno <strong>6</strong>.
          </p>

          <div className="mt-4 grid grid-cols-3 gap-3">
            <div className="rounded-xl bg-slate-50 p-3">
              <div className="text-[11px] text-slate-500">Selezionate</div>
              <div className="mt-1 text-lg font-semibold text-slate-900">
                {selectedStats.shipments}
              </div>
            </div>
            <div className="rounded-xl bg-slate-50 p-3">
              <div className="text-[11px] text-slate-500">Pallet totali</div>
              <div className="mt-1 text-lg font-semibold text-slate-900">
                {selectedStats.pallets}
              </div>
            </div>
            <div className="rounded-xl bg-slate-50 p-3">
              <div className="text-[11px] text-slate-500">DDT mancanti</div>
              <div className="mt-1 text-lg font-semibold text-slate-900">
                {selectedStats.missingDdt}
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border bg-white p-4 lg:col-span-2">
          <div className="flex items-center gap-2">
            <Truck className="h-4 w-4 text-slate-700" />
            <h2 className="text-sm font-semibold text-slate-900">Crea WAVE</h2>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-4">
            <div className="md:col-span-2">
              <label className="block text-xs font-medium text-slate-700">
                Trasportatore
              </label>
              {carriers.length > 0 ? (
                <select
                  value={carrierId}
                  onChange={(e) => setCarrierId(e.target.value)}
                  className="mt-1 w-full rounded-xl border bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-200"
                >
                  {carriers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  value={carrierId}
                  onChange={(e) => setCarrierId(e.target.value)}
                  placeholder="carrier_id (UUID)"
                  className="mt-1 w-full rounded-xl border bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-200"
                />
              )}
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700">
                Data ritiro wave
              </label>
              <div className="relative mt-1">
                <Calendar className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="date"
                  value={plannedDate}
                  onChange={(e) => setPlannedDate(e.target.value)}
                  className="w-full rounded-xl border bg-white py-2 pl-10 pr-3 text-sm outline-none focus:ring-2 focus:ring-slate-200"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700">
                Finestra ritiro
              </label>
              <input
                value={pickupWindow}
                onChange={(e) => setPickupWindow(e.target.value)}
                placeholder="09:00-18:00"
                className="mt-1 w-full rounded-xl border bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-200"
              />
            </div>
          </div>

          <div className="mt-3">
            <label className="block text-xs font-medium text-slate-700">
              Note (opzionale)
            </label>
            <input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Es. Wave settimanale Campania"
              className="mt-1 w-full rounded-xl border bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-200"
            />
          </div>

          <div className="mt-4 flex items-center justify-between">
            <div className="text-xs text-slate-600">
              {selectedStats.pallets < 6 ? (
                <span>
                  Seleziona almeno <strong>6 pallet</strong> per creare una
                  wave.
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-emerald-700">
                  <CheckCircle2 className="h-4 w-4" /> Pronto per creare la wave
                </span>
              )}
            </div>

            <button
              onClick={() => void createWave()}
              disabled={creating || selectedStats.pallets < 6 || !carrierId}
              className={cn(
                "inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold",
                creating || selectedStats.pallets < 6 || !carrierId
                  ? "bg-slate-200 text-slate-500"
                  : "bg-slate-900 text-white hover:bg-slate-800"
              )}
            >
              {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Crea WAVE
            </button>
          </div>
        </div>
      </div>

      {err ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
          <div className="font-semibold">Errore</div>
          <div className="mt-1 break-words text-xs">{err}</div>
        </div>
      ) : null}

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-slate-600">
          <Loader2 className="h-4 w-4 animate-spin" /> Caricamento…
        </div>
      ) : null}

      {/* Pool table */}
      <div className="rounded-2xl border bg-white">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <div className="flex items-center gap-2">
            <Package className="h-4 w-4 text-slate-700" />
            <div>
              <div className="text-sm font-semibold text-slate-900">
                Spedizioni eleggibili
              </div>
              <div className="text-xs text-slate-500">{pool.length} in pool</div>
            </div>
          </div>

          <button
            onClick={() => {
              const next: Record<string, boolean> = {};
              for (const p of pool) next[p.shipment_id] = true;
              setSelected(next);
            }}
            className="text-xs font-medium text-slate-600 hover:text-slate-900"
          >
            Seleziona tutto
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs text-slate-600">
              <tr>
                <th className="px-4 py-3">&nbsp;</th>
                <th className="px-4 py-3">Spedizione</th>
                <th className="px-4 py-3">Mittente</th>
                <th className="px-4 py-3">Ritiro richiesto</th>
                <th className="px-4 py-3">Pallet</th>
                <th className="px-4 py-3">DDT</th>
              </tr>
            </thead>

            <tbody className="divide-y">
              {pool.map((p) => {
                const checked = !!selected[p.shipment_id];
                return (
                  <tr key={p.shipment_id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(e) =>
                          setSelected((prev) => ({
                            ...prev,
                            [p.shipment_id]: e.target.checked,
                          }))
                        }
                        className="h-4 w-4 rounded border-slate-300"
                      />
                    </td>

                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-slate-900">
                          {p.human_id}
                        </span>
                        <Link
                          href={`/back-office/spedizioni/${encodeURIComponent(
                            p.human_id
                          )}`}
                          className="inline-flex items-center gap-1 text-xs text-slate-600 hover:text-slate-900"
                        >
                          Apri <ExternalLink className="h-3 w-3" />
                        </Link>
                      </div>
                      <div className="mt-1 text-[11px] text-slate-500">
                        ID: {p.shipment_id.slice(0, 8)}…
                      </div>
                    </td>

                    <td className="px-4 py-3">
                      <div className="text-sm text-slate-800">
                        {p.mittente_citta ?? "—"}
                      </div>
                      <div className="text-[11px] text-slate-500">
                        CAP: {p.mittente_cap ?? "—"}
                      </div>
                    </td>

                    <td className="px-4 py-3 text-slate-800">
                      {formatDate(p.giorno_ritiro)}
                    </td>

                    <td className="px-4 py-3">
                      <span className="inline-flex items-center rounded-lg bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-800">
                        {p.pallet_count}
                      </span>
                    </td>

                    <td className="px-4 py-3">
                      {p.has_ddt ? (
                        <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
                          OK
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                          Mancante
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}

              {pool.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-8 text-center text-sm text-slate-500"
                  >
                    Nessuna spedizione pallet Campania disponibile nel pool.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      {/* Waves list */}
      <div className="rounded-2xl border bg-white">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <div className="flex items-center gap-2">
            <Truck className="h-4 w-4 text-slate-700" />
            <div>
              <div className="text-sm font-semibold text-slate-900">WAVE</div>
              <div className="text-xs text-slate-500">{waves.length} wave</div>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs text-slate-600">
              <tr>
                <th className="px-4 py-3">Codice</th>
                <th className="px-4 py-3">Carrier</th>
                <th className="px-4 py-3">Stato</th>
                <th className="px-4 py-3">Ritiro wave</th>
                <th className="px-4 py-3">Finestra</th>
                <th className="px-4 py-3">Note</th>
                <th className="px-4 py-3">&nbsp;</th>
              </tr>
            </thead>

            <tbody className="divide-y">
              {waves.map((w) => (
                <tr key={w.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-900">
                    {w.code}
                  </td>
                  <td className="px-4 py-3 text-slate-700">
                    {w.carriers?.name ?? "—"}
                  </td>
                  <td className="px-4 py-3">
                    <span className={statusPill(w.status)}>{w.status}</span>
                  </td>
                  <td className="px-4 py-3 text-slate-700">
                    {formatDate(w.planned_pickup_date)}
                  </td>
                  <td className="px-4 py-3 text-slate-700">
                    {w.pickup_window ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-slate-700">
                    <span className="line-clamp-2 max-w-[420px] text-xs">
                      {w.notes ?? "—"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/back-office/pallet/waves/${encodeURIComponent(
                        w.id
                      )}`}
                      className="text-xs font-semibold text-slate-700 hover:text-slate-900"
                    >
                      Dettaglio
                    </Link>
                  </td>
                </tr>
              ))}

              {waves.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-4 py-8 text-center text-sm text-slate-500"
                  >
                    Nessuna wave creata.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      <div className="text-xs text-slate-500">
        Suggerimento: per ora il trasportatore lavora solo su ritiri + DDT. Gli
        stati avanzati (consegna, POD, foto) arriveranno con versioning.
      </div>
    </div>
  );
}
