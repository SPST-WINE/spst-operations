"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Calendar, ExternalLink, Loader2, Search } from "lucide-react";

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

function fmtDate(x?: string | null) {
  return x || "—";
}

export default function CarrierWavesClient() {
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [waves, setWaves] = useState<WaveListItem[]>([]);

  const [q, setQ] = useState("");
  const [status, setStatus] = useState<string>("all");

   async function load() {
    setLoading(true);
    setErr(null);
    try {
      // ✅ Canonico per CARRIER:
      // /api/pallets/waves/list filtra automaticamente per carrier_id (via carrier_users)
      // e in caso staff usa admin (service role) lato route.
      let res: { items: WaveListItem[] } | null = null;

      try {
        res = await fetchJson<{ items: WaveListItem[] }>(
          "/api/pallets/waves/list"
        );
      } catch (e) {
        // fallback legacy (se esiste ancora /api/pallets/waves con RLS)
        res = await fetchJson<{ items: WaveListItem[] }>("/api/pallets/waves");
      }

      setWaves(res.items ?? []);
    } catch (e: any) {
      setErr(String(e?.message ?? e));
      setWaves([]);
    } finally {
      setLoading(false);
    }
  }


  useEffect(() => {
    void load();
  }, []);

  const filtered = useMemo(() => {
    const qq = q.trim().toLowerCase();
    return (waves ?? []).filter((w) => {
      // Carrier vede solo wave INVIATA e oltre (esclude BOZZA)
      const waveStatus = (w.status ?? "").toLowerCase();
      const isNotBozza = waveStatus !== "bozza";
      
      const okStatus =
        status === "all" ? isNotBozza : (w.status ?? "").toLowerCase() === status;
      const okQuery =
        !qq ||
        (w.code ?? "").toLowerCase().includes(qq) ||
        (w.carriers?.name ?? "").toLowerCase().includes(qq) ||
        (w.notes ?? "").toLowerCase().includes(qq);
      return okStatus && okQuery;
    });
  }, [waves, q, status]);

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Cerca per codice, note, carrier…"
                className="h-10 w-full rounded-xl border bg-white pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-slate-200 md:w-[360px]"
              />
            </div>

            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="h-10 rounded-xl border bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-slate-200"
            >
              <option value="all">Tutti gli stati</option>
              <option value="bozza">Bozza</option>
              <option value="inviata">Inviata</option>
              <option value="in_corso">In corso</option>
              <option value="completata">Completata</option>
              <option value="annullata">Annullata</option>
            </select>
          </div>

          <button
            onClick={() => void load()}
            className="inline-flex h-10 items-center justify-center rounded-xl border bg-white px-4 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Ricarica
          </button>
        </div>
      </div>

      <div className="rounded-2xl border bg-white shadow-sm">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <div className="text-sm font-semibold text-slate-900">
            Waves ({filtered.length})
          </div>
          {loading ? (
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" /> Caricamento…
            </div>
          ) : null}
        </div>

        {err ? (
          <div className="px-4 py-4 text-sm text-rose-700">
            Errore: {err}
          </div>
        ) : null}

        {!loading && filtered.length === 0 ? (
          <div className="px-4 py-8 text-sm text-slate-600">
            Nessuna wave trovata.
          </div>
        ) : null}

        <div className="divide-y">
          {filtered.map((w) => (
            <div key={w.id} className="px-4 py-4">
              <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <div className="text-sm font-semibold text-slate-900">
                      {w.code}
                    </div>
                    <span className={statusPill(w.status)}>{w.status}</span>
                  </div>

                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600">
                    <span className="inline-flex items-center gap-1">
                      <Calendar className="h-3.5 w-3.5" />
                      {fmtDate(w.planned_pickup_date)}{" "}
                      {w.pickup_window ? `• ${w.pickup_window}` : ""}
                    </span>
                    <span>
                      Carrier:{" "}
                      <span className="font-medium text-slate-800">
                        {w.carriers?.name ?? "—"}
                      </span>
                    </span>
                  </div>

                  {w.notes ? (
                    <div className="text-xs text-slate-500">{w.notes}</div>
                  ) : null}
                </div>

                <div className="flex items-center gap-2">
                  <Link
                    href={`/carrier/waves/${w.id}`}
                    className="inline-flex h-9 items-center justify-center rounded-xl bg-slate-900 px-3 text-sm font-medium text-white hover:bg-slate-800"
                  >
                    Apri
                  </Link>
                  <Link
                    href={`/carrier/waves/${w.id}/print`}
                    className="inline-flex h-9 items-center justify-center rounded-xl border bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
                  >
                    <ExternalLink className="mr-2 h-4 w-4" />
                    Print
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
