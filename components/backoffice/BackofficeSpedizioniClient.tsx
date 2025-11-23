// components/backoffice/BackofficeSpedizioniClient.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Search, ArrowUpDown, ExternalLink, Package } from "lucide-react";

type Row = {
  id: string;
  created_at?: string | null;
  human_id?: string | null;
  email_norm?: string | null;
  email_cliente?: string | null;
  mittente_paese?: string | null;
  mittente_citta?: string | null;
  dest_paese?: string | null;
  dest_citta?: string | null;
  colli_n?: number | null;
  formato_sped?: string | null;
  tipo_spedizione?: string | null;
  incoterm?: string | null;
  packages?: { id: string; l1: number | null; l2: number | null; l3: number | null; weight_kg: number | null }[];
  status?: string | null;
  [key: string]: any;
};

type SortKey = "created_desc" | "ritiro_desc" | "dest_az";

function norm(s?: string | null) {
  return (s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
}

function StatusBadge({ value }: { value?: string | null }) {
  const v = (value || "").toLowerCase();
  let cls = "bg-slate-100 text-slate-700 ring-slate-200";
  let text = value || "—";

  if (v.includes("in transito") || v.includes("intransit"))
    cls = "bg-sky-50 text-sky-700 ring-sky-200";
  else if (v.includes("in consegna") || v.includes("outfordelivery"))
    cls = "bg-amber-50 text-amber-700 ring-amber-200";
  else if (v.includes("consegn"))
    cls = "bg-emerald-50 text-emerald-700 ring-emerald-200";
  else if (v.includes("eccez") || v.includes("exception") || v.includes("failed"))
    cls = "bg-rose-50 text-rose-700 ring-rose-200";

  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ${cls}`}
    >
      {text}
    </span>
  );
}

export default function BackofficeSpedizioniClient() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<SortKey>("created_desc");

  useEffect(() => {
    let alive = true;

    (async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (q.trim()) params.set("q", q.trim());
        params.set("sort", sort);
        params.set("limit", "50");
        params.set("page", "1");

        const res = await fetch(`/api/spedizioni?${params.toString()}`, {
          cache: "no-store",
        });
        const j = await res.json().catch(() => ({}));

        if (!alive) return;

        if (j?.ok && Array.isArray(j.rows)) {
          const flat: Row[] = j.rows.map((r: any) => ({
            id: r.id,
            created_at: r.created_at || null,
            ...r,
          }));
          setRows(flat);
        } else {
          setRows([]);
        }
      } catch (err) {
        console.error("[BackofficeSpedizioniClient] load error:", err);
        if (alive) setRows([]);
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [q, sort]);

  const filtered = useMemo(() => {
    const needle = norm(q);
    let arr = rows;

    if (needle) {
      arr = arr.filter((r) => {
        const hay = [
          r.human_id,
          r.email_norm || r.email_cliente,
          r.dest_citta,
          r.dest_paese,
          r.mittente_citta,
          r.mittente_paese,
        ]
          .map(norm)
          .join(" | ");
        return hay.includes(needle);
      });
    }

    const copy = [...arr];
    copy.sort((a, b) => {
      if (sort === "ritiro_desc") {
        const da = a.giorno_ritiro ? new Date(a.giorno_ritiro).getTime() : 0;
        const db = b.giorno_ritiro ? new Date(b.giorno_ritiro).getTime() : 0;
        return db - da;
      }
      if (sort === "dest_az") {
        const aa = `${a.dest_citta || ""} ${a.dest_paese || ""}`.toLowerCase();
        const bb = `${b.dest_citta || ""} ${b.dest_paese || ""}`.toLowerCase();
        return aa.localeCompare(bb);
      }
      // default: created_desc
      const ca = a.created_at ? new Date(a.created_at).getTime() : 0;
      const cb = b.created_at ? new Date(b.created_at).getTime() : 0;
      return cb - ca;
    });

    return copy;
  }, [rows, q, sort]);

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-slate-400" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Cerca: email, città, paese, ID…"
            className="pl-8 pr-3 py-2 text-sm rounded-lg border bg-white w-72"
          />
        </div>
        <div className="relative">
          <ArrowUpDown className="absolute left-2 top-2.5 h-4 w-4 text-slate-400" />
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
            className="pl-8 pr-3 py-2 text-sm rounded-lg border bg-white"
          >
            <option value="created_desc">Data creazione (nuove prima)</option>
            <option value="ritiro_desc">Data ritiro (recenti prima)</option>
            <option value="dest_az">Destinazione A → Z</option>
          </select>
        </div>
      </div>

      {/* Lista */}
      <div className="rounded-2xl border bg-white">
        <div className="grid grid-cols-[1.6fr_1.6fr_1.2fr_1.2fr_1.2fr_0.9fr] gap-3 border-b px-4 py-2 text-[11px] font-medium uppercase tracking-wide text-slate-500">
          <div>ID / Cliente</div>
          <div>Mittente</div>
          <div>Destinatario</div>
          <div>Colli</div>
          <div>Tipo / Incoterm</div>
          <div className="text-right">Azioni</div>
        </div>

        {loading ? (
          <div className="px-4 py-8 text-center text-sm text-slate-500">
            Caricamento spedizioni…
          </div>
        ) : filtered.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-slate-500">
            Nessuna spedizione trovata.
          </div>
        ) : (
          <div className="divide-y">
            {filtered.map((r) => {
              const mitt = [r.mittente_citta, r.mittente_paese]
                .filter(Boolean)
                .join(" • ");
              const dest = [r.dest_citta, r.dest_paese].filter(Boolean).join(" • ");
              const email = r.email_norm || r.email_cliente || "—";
              const colliCount =
                typeof r.colli_n === "number"
                  ? r.colli_n
                  : Array.isArray(r.packages)
                  ? r.packages.length
                  : undefined;
              const tipoColli = r.formato_sped || "Pacchi";

              return (
                <div
                  key={r.id}
                  className="grid grid-cols-[1.6fr_1.6fr_1.2fr_1.2fr_1.2fr_0.9fr] gap-3 px-4 py-3 text-xs items-center"
                >
                  {/* ID + email + status */}
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-slate-900">
                        {r.human_id || r.id}
                      </span>
                      <StatusBadge value={r.status} />
                    </div>
                    <div className="text-[11px] text-slate-500">{email}</div>
                  </div>

                  {/* Mittente */}
                  <div className="text-[11px] text-slate-700">
                    <div className="font-medium text-slate-800">
                      {r.mittente_rs || "Mittente"}
                    </div>
                    <div>{mitt || "—"}</div>
                  </div>

                  {/* Destinatario */}
                  <div className="text-[11px] text-slate-700">
                    <div className="font-medium text-slate-800">
                      {r.dest_rs || "Destinatario"}
                    </div>
                    <div>{dest || "—"}</div>
                  </div>

                  {/* Colli */}
                  <div className="text-[11px] text-slate-700">
                    <div className="flex items-center gap-1">
                      <Package className="h-3.5 w-3.5 text-slate-400" />
                      <span className="font-medium">
                        {colliCount != null ? `${colliCount} colli` : "—"}
                      </span>
                    </div>
                    <div className="text-slate-500">
                      {tipoColli || "Pacchi standard"}
                    </div>
                  </div>

                  {/* Tipo spedizione / Incoterm */}
                  <div className="text-[11px] text-slate-700">
                    <div className="font-medium">
                      {r.tipo_spedizione || "—"}
                    </div>
                    <div className="text-slate-500">
                      Incoterm: {r.incoterm || "—"}
                    </div>
                  </div>

                  {/* Azioni */}
                  <div className="flex items-center justify-end gap-2">
                    <Link
                      href={`/back-office/spedizioni/${r.id}`}
                      target="_blank"
                      className="inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-50"
                    >
                      <ExternalLink className="h-3 w-3" />
                      Scheda
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
