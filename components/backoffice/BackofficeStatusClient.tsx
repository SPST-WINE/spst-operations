"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Search, ArrowUpDown, ExternalLink, Package, Boxes, CheckCircle2, AlertTriangle, Ban, Truck } from "lucide-react";
import type { ShipmentStatus } from "@/lib/contracts/shipment";

type ShipmentRow = {
  id: string;
  created_at?: string;
  human_id?: string | null;

  email_cliente?: string | null;
  email_norm?: string | null;

  tipo_spedizione?: string | null;

  mittente_paese?: string | null;
  mittente_citta?: string | null;
  dest_paese?: string | null;
  dest_citta?: string | null;

  colli_n?: number | null;
  formato_sped?: string | null;

  tracking_code?: string | null;
  carrier?: string | null;

  status?: ShipmentStatus | null;
};

const STATUSES: ShipmentStatus[] = [
  "CREATA",
  "IN RITIRO",
  "IN TRANSITO",
  "CONSEGNATA",
  "ECCEZIONE",
  "ANNULLATA",
];

function norm(s?: string | null) {
  return (s || "")
    .toString()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
}

function formatDate(s?: string) {
  if (!s) return "—";
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("it-IT", { dateStyle: "short", timeStyle: "short" });
}

function statusPill(status?: ShipmentStatus | null) {
  const base = "inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[10px] font-medium";
  switch (status) {
    case "CONSEGNATA":
      return { cls: `${base} border-emerald-200 bg-emerald-50 text-emerald-700`, icon: CheckCircle2 };
    case "ECCEZIONE":
      return { cls: `${base} border-amber-200 bg-amber-50 text-amber-700`, icon: AlertTriangle };
    case "ANNULLATA":
      return { cls: `${base} border-rose-200 bg-rose-50 text-rose-700`, icon: Ban };
    case "IN TRANSITO":
      return { cls: `${base} border-slate-200 bg-slate-50 text-slate-700`, icon: Truck };
    case "IN RITIRO":
      return { cls: `${base} border-slate-200 bg-white text-slate-700`, icon: Truck };
    case "CREATA":
    default:
      return { cls: `${base} border-slate-200 bg-white text-slate-700`, icon: Truck };
  }
}

export default function BackofficeStatusClient() {
  const [rows, setRows] = useState<ShipmentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");

  // UI state per update status
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function load() {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        params.set("sort", "created_desc");
        params.set("limit", "200");

        const res = await fetch(`/api/backoffice/shipments?${params.toString()}`, {
          cache: "no-store",
        });
        const data = await res.json().catch(() => ({}));
        if (!active) return;

        if (data?.ok && Array.isArray(data.rows)) {
          setRows(data.rows as ShipmentRow[]);
        } else {
          setRows([]);
        }
      } catch (e) {
        console.error("[BackofficeStatusClient] load error:", e);
        if (active) setRows([]);
      } finally {
        if (active) setLoading(false);
      }
    }

    load();
    return () => {
      active = false;
    };
  }, []);

  const filtered = useMemo(() => {
    const needle = norm(q);
    if (!needle) return rows;

    return rows.filter((r) => {
      const hay = [
        r.human_id || r.id,
        r.email_cliente || r.email_norm,
        r.mittente_citta,
        r.mittente_paese,
        r.dest_citta,
        r.dest_paese,
        r.tipo_spedizione,
        r.tracking_code,
        r.carrier,
        r.status,
      ]
        .map(norm)
        .join(" | ");
      return hay.includes(needle);
    });
  }, [rows, q]);

  async function setStatus(shipmentId: string, next: ShipmentStatus) {
    // optimistic update
    const prev = rows;
    setRows((cur) => cur.map((r) => (r.id === shipmentId ? { ...r, status: next } : r)));

    setSaving((m) => ({ ...m, [shipmentId]: true }));
    setToast(null);

    try {
      const res = await fetch(`/api/backoffice/shipments/${shipmentId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ok) {
        throw new Error(data?.details || data?.error || "Update failed");
      }
      setToast("✅ Status aggiornato.");
      // allinea con risposta server
      const serverStatus = data?.shipment?.status as ShipmentStatus | undefined;
      if (serverStatus) {
        setRows((cur) =>
          cur.map((r) => (r.id === shipmentId ? { ...r, status: serverStatus } : r))
        );
      }
    } catch (e: any) {
      // rollback
      setRows(prev);
      setToast(`❌ ${e?.message || "Errore update"}`);
    } finally {
      setSaving((m) => {
        const { [shipmentId]: _, ...rest } = m;
        return rest;
      });

      // auto-hide toast
      setTimeout(() => setToast(null), 2500);
    }
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <span className="font-medium text-slate-700">Update status spedizioni</span>
          <span className="h-1 w-1 rounded-full bg-slate-300" />
          <span>
            {filtered.length} su {rows.length} spedizioni
          </span>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative flex items-center">
            <Search className="pointer-events-none absolute left-2 h-4 w-4 text-slate-400" />
            <input
              type="search"
              placeholder="Cerca per SP-XXXX, email, città, tracking, status…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="h-9 w-72 rounded-lg border border-slate-200 bg-white pl-8 pr-3 text-xs outline-none placeholder:text-slate-400 focus:border-slate-400"
            />
          </div>
          <button
            type="button"
            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] text-slate-600"
            disabled
          >
            <ArrowUpDown className="h-3 w-3" />
            Ordina
          </button>
        </div>
      </div>

      {toast && (
        <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700">
          {toast}
        </div>
      )}

      {/* Tabella */}
      <div className="overflow-hidden rounded-2xl border bg-white">
        <table className="min-w-full border-collapse text-xs">
          <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-3 py-2 text-left">Rif.</th>
              <th className="px-3 py-2 text-left">Email cliente</th>
              <th className="px-3 py-2 text-left">Mittente</th>
              <th className="px-3 py-2 text-left">Destinatario</th>
              <th className="px-3 py-2 text-left">Colli</th>
              <th className="px-3 py-2 text-left">Tipo sped.</th>
              <th className="px-3 py-2 text-left">Corriere</th>
              <th className="px-3 py-2 text-left">Tracking</th>

              {/* ✅ status + selector */}
              <th className="px-3 py-2 text-left">Status</th>
              <th className="px-3 py-2 text-left">Cambia</th>

              <th className="px-3 py-2 text-left">Creato il</th>
              <th className="px-3 py-2 text-right">Azioni</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-100">
            {loading && rows.length === 0 ? (
              <tr>
                <td colSpan={12} className="px-3 py-6 text-center text-slate-400">
                  Caricamento spedizioni…
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={12} className="px-3 py-6 text-center text-slate-400">
                  Nessuna spedizione trovata.
                </td>
              </tr>
            ) : (
              filtered.map((r) => {
                const isPallet = /pallet/i.test(r.formato_sped || "");
                const ref = r.human_id || r.id;
                const email = r.email_cliente || r.email_norm || "—";
                const mittente = [r.mittente_citta, r.mittente_paese].filter(Boolean).join(", ");
                const dest = [r.dest_citta, r.dest_paese].filter(Boolean).join(", ");
                const colli = [
                  typeof r.colli_n === "number" ? `${r.colli_n}` : "—",
                  r.formato_sped,
                ]
                  .filter(Boolean)
                  .join(" · ");

                const carrier = (r.carrier || "").trim() || "—";
                const tracking = (r.tracking_code || "").trim() || "—";

                const pill = statusPill(r.status || "CREATA");
                const Icon = pill.icon;

                const isSaving = !!saving[r.id];

                return (
                  <tr key={r.id} className="hover:bg-slate-50/70">
                    <td className="px-3 py-2 align-middle">
                      <div className="flex items-center gap-2">
                        <span
                          className={[
                            "inline-flex h-7 w-7 items-center justify-center rounded-lg",
                            isPallet
                              ? "bg-orange-50 text-spst-orange border border-orange-200"
                              : "bg-slate-100 text-slate-700",
                          ].join(" ")}
                        >
                          {isPallet ? <Boxes className="h-4 w-4" /> : <Package className="h-4 w-4" />}
                        </span>

                        <div className="flex flex-col">
                          <span className="font-semibold text-slate-900">{ref}</span>
                        </div>
                      </div>
                    </td>

                    <td className="px-3 py-2 align-middle">
                      <span className="text-[11px] text-slate-700">{email}</span>
                    </td>

                    <td className="px-3 py-2 align-middle">
                      <span className="text-[11px] text-slate-700">{mittente || "—"}</span>
                    </td>

                    <td className="px-3 py-2 align-middle">
                      <span className="text-[11px] text-slate-700">{dest || "—"}</span>
                    </td>

                    <td className="px-3 py-2 align-middle">
                      <span className="text-[11px] text-slate-700">{colli}</span>
                    </td>

                    <td className="px-3 py-2 align-middle">
                      <span className="text-[11px] text-slate-700">{r.tipo_spedizione || "—"}</span>
                    </td>

                    <td className="px-3 py-2 align-middle">
                      <span className="text-[11px] text-slate-700">{carrier}</span>
                    </td>

                    <td className="px-3 py-2 align-middle">
                      <span className="text-[11px] text-slate-700">{tracking}</span>
                    </td>

                    {/* ✅ STATUS */}
                    <td className="px-3 py-2 align-middle">
                      <span className={pill.cls}>
                        <Icon className="h-3 w-3" />
                        {r.status || "CREATA"}
                      </span>
                    </td>

                    {/* ✅ SELECT CAMBIO STATUS */}
                    <td className="px-3 py-2 align-middle">
                      <select
                        value={r.status || "CREATA"}
                        onChange={(e) => setStatus(r.id, e.target.value as ShipmentStatus)}
                        disabled={isSaving}
                        className="h-8 rounded-lg border border-slate-200 bg-white px-2 text-[11px] text-slate-700 outline-none focus:border-slate-400 disabled:opacity-60"
                      >
                        {STATUSES.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                    </td>

                    <td className="px-3 py-2 align-middle">
                      <span className="text-[11px] text-slate-700">{formatDate(r.created_at)}</span>
                    </td>

                    <td className="px-3 py-2 align-middle text-right">
                      <Link
                        href={`/back-office/spedizioni/${r.id}`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] text-slate-700 hover:bg-slate-50"
                      >
                        <ExternalLink className="h-3 w-3" />
                        Dettaglio
                      </Link>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
