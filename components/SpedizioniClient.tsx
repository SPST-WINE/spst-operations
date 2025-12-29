"use client";

import { useEffect, useMemo, useState } from "react";
import { Package, Boxes, Search, ArrowUpDown } from "lucide-react";
import Drawer from "@/components/Drawer";
import ShipmentDetail from "@/components/ShipmentDetail";

type Row = {
  id: string;
  human_id?: string;
  _createdTime?: string | null;
  [key: string]: any;
};

function norm(s?: string) {
  return (s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
}

function StatusBadge({ value }: { value?: string }) {
  const raw = (value || "").trim();

  // normalizzo: maiuscolo, spazi “puliti”
  const v = raw
    .toUpperCase()
    .replace(/\s+/g, " ")
    .trim();

  const map: Record<string, { cls: string; label: string }> = {
    CREATA: {
      cls: "bg-slate-50 text-slate-700 ring-slate-200",
      label: "CREATA",
    },
    "IN RITIRO": {
      cls: "bg-amber-50 text-amber-800 ring-amber-200",
      label: "IN RITIRO",
    },
    "IN TRANSITO": {
      cls: "bg-sky-50 text-sky-800 ring-sky-200",
      label: "IN TRANSITO",
    },
    CONSEGNATA: {
      cls: "bg-emerald-50 text-emerald-800 ring-emerald-200",
      label: "CONSEGNATA",
    },
    ECCEZIONE: {
      cls: "bg-rose-50 text-rose-800 ring-rose-200",
      label: "ECCEZIONE",
    },
    ANNULLATA: {
      cls: "bg-zinc-50 text-zinc-700 ring-zinc-200",
      label: "ANNULLATA",
    },
  };

  // fallback: se arriva roba legacy (tipo "in consegna", "failed", ecc.)
  let cls = "bg-slate-50 text-slate-700 ring-slate-200";
  let text = raw || "—";

  if (map[v]) {
    cls = map[v].cls;
    text = map[v].label;
  } else {
    const low = raw.toLowerCase();
    if (low.includes("transit")) cls = "bg-sky-50 text-sky-800 ring-sky-200";
    else if (low.includes("consegn")) cls = "bg-emerald-50 text-emerald-800 ring-emerald-200";
    else if (low.includes("ritiro")) cls = "bg-amber-50 text-amber-800 ring-amber-200";
    else if (low.includes("eccez") || low.includes("failed"))
      cls = "bg-rose-50 text-rose-800 ring-rose-200";
    else if (low.includes("annull")) cls = "bg-zinc-50 text-zinc-700 ring-zinc-200";
  }

  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs ring-1 ${cls}`}
    >
      {text}
    </span>
  );
}


function Card({ r, onDetails }: { r: Row; onDetails: () => void }) {
  const isPallet = /pallet/i.test(r.formato_sped || "");
  const ref = r.human_id || r.id;
  const destRS = r.dest_rs || "—";
  const dest = [r.dest_citta, r.dest_paese].filter(Boolean).join(" ");

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm hover:shadow-md transition-shadow min-h-[112px] flex items-start gap-4">
      <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-700 shrink-0">
        {isPallet ? <Boxes className="h-5 w-5" /> : <Package className="h-5 w-5" />}
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="font-semibold text-slate-900 truncate">{ref}</div>
            <div className="text-sm text-slate-700 truncate">
              Destinatario: {destRS}
            </div>
            <div className="text-sm text-slate-500 truncate">
              Destinazione: {dest || "—"}
            </div>
          </div>
          <StatusBadge value={r.status} />
        </div>

        <div className="mt-3">
          <button
            onClick={onDetails}
            className="text-xs text-[#1c3e5e] underline"
          >
            Mostra dettagli
          </button>
        </div>
      </div>
    </div>
  );
}

export default function SpedizioniClient() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<
    "created_desc" | "ritiro_desc" | "dest_az" | "status"
  >("created_desc");

  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Row | null>(null);

  // 🔥 DTO COMPLETO PER IL DRAWER
  const [detail, setDetail] = useState<any | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  /* ───────────── LOAD LIST ───────────── */
  useEffect(() => {
    let alive = true;

    (async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (q.trim()) params.set("q", q.trim());
        if (sort) params.set("sort", sort);

        const res = await fetch(`/api/spedizioni?${params}`, {
          cache: "no-store",
        });
        const j = await res.json();

        if (!alive) return;

        if (j?.ok && Array.isArray(j.rows)) {
          setRows(
            j.rows.map((r: any) => ({
              id: r.id,
              human_id: r.human_id,
              _createdTime: r.created_at,
              ...r,
            }))
          );
        } else {
          setRows([]);
        }
      } catch (e) {
        console.error("load list error", e);
        if (alive) setRows([]);
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [q, sort]);

  /* ───────────── FILTER + SORT ───────────── */
  const filtered = useMemo(() => {
    const needle = norm(q);

    const arr = !needle
      ? rows
      : rows.filter((r) =>
          [
            r.human_id,
            r.dest_rs,
            r.dest_citta,
            r.dest_paese,
            r.mittente_rs,
          ]
            .map(norm)
            .join(" ")
            .includes(needle)
        );

    return [...arr].sort((a, b) => {
      const ca = a._createdTime ? new Date(a._createdTime).getTime() : 0;
      const cb = b._createdTime ? new Date(b._createdTime).getTime() : 0;
      return cb - ca;
    });
  }, [rows, q, sort]);

  return (
    <>
      {/* TOOLBAR */}
      <div className="flex gap-3 mb-4">
        <div className="relative">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-slate-400" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Cerca spedizione…"
            className="pl-8 pr-3 py-2 text-sm rounded-lg border bg-white"
          />
        </div>
        <div className="relative">
          <ArrowUpDown className="absolute left-2 top-2.5 h-4 w-4 text-slate-400" />
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as any)}
            className="pl-8 pr-3 py-2 text-sm rounded-lg border bg-white"
          >
            <option value="created_desc">Data creazione</option>
            <option value="ritiro_desc">Data ritiro</option>
            <option value="dest_az">Destinazione</option>
            <option value="status">Stato</option>
          </select>
        </div>
      </div>

      {/* LIST */}
      {loading ? (
        <div className="text-sm text-slate-500">Caricamento…</div>
      ) : filtered.length === 0 ? (
        <div className="text-sm text-slate-500">Nessuna spedizione trovata.</div>
      ) : (
        <div className="space-y-3">
          {filtered.map((r) => (
            <Card
              key={r.id}
              r={r}
              onDetails={async () => {
                setSelected(r);
                setOpen(true);
                setDetail(null);
                setDetailLoading(true);

                try {
                  const ref = r.human_id || r.id;
                  const res = await fetch(`/api/spedizioni/${ref}`, {
                    cache: "no-store",
                  });
                  const j = await res.json();
                  if (j?.ok) setDetail(j.shipment);
                } catch (e) {
                  console.error("detail load error", e);
                } finally {
                  setDetailLoading(false);
                }
              }}
            />
          ))}
        </div>
      )}

      {/* DRAWER */}
      <Drawer
        open={open}
        onClose={() => setOpen(false)}
        title={detail?.human_id || selected?.human_id || selected?.id}
      >
        {detailLoading ? (
          <div className="text-sm text-slate-500">Caricamento dettagli…</div>
        ) : detail ? (
          <ShipmentDetail shipment={detail} />
        ) : null}
      </Drawer>
    </>
  );
}
