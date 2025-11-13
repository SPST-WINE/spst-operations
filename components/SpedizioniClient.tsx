// components/SpedizioniClient.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { Package, Boxes, Search, ArrowUpDown } from "lucide-react";
import Drawer from "@/components/Drawer";
import ShipmentDetail from "@/components/ShipmentDetail";
import { getIdToken } from "@/lib/firebase-client-auth";

type Row = {
  id: string;
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
  const v = (value || "").toLowerCase();
  let cls = "bg-amber-50 text-amber-700 ring-amber-200";
  let text = value || "—";
  if (v.includes("in transito") || v.includes("intransit")) cls = "bg-sky-50 text-sky-700 ring-sky-200";
  else if (v.includes("in consegna") || v.includes("outfordelivery")) cls = "bg-amber-50 text-amber-700 ring-amber-200";
  else if (v.includes("consegn")) cls = "bg-emerald-50 text-emerald-700 ring-emerald-200";
  else if (v.includes("eccez") || v.includes("exception") || v.includes("failed")) cls = "bg-rose-50 text-rose-700 ring-rose-200";
  return <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs ring-1 ${cls}`}>{text}</span>;
}

function Card({ r, onDetails }: { r: Row; onDetails: () => void }) {
  const isPallet = /pallet/i.test(r.formato_sped || r["Formato"] || "");
  const ref = r.human_id || r["ID Spedizione"] || r.id;
  const destRS = r.dest_rs || r["Destinatario - Ragione Sociale"] || r["Destinatario"] || "—";
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
            {destRS ? <div className="text-sm text-slate-700 truncate">Destinatario: {destRS}</div> : null}
            <div className="text-sm text-slate-500 truncate">Destinazione: {dest || "—"}</div>
          </div>
          <StatusBadge value={r.status || r["Stato"]} />
        </div>
        <div className="mt-3">
          <button onClick={onDetails} className="text-xs text-[#1c3e5e] underline">
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
  const [sort, setSort] = useState<"created_desc" | "ritiro_desc" | "dest_az" | "status">("created_desc");

  const [open, setOpen] = useState(false);
  const [sel, setSel] = useState<Row | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (q.trim()) params.set("q", q.trim());
        if (sort) params.set("sort", sort);

        const headers: HeadersInit = {};
        try {
          const token = await getIdToken();
          if (token) headers["Authorization"] = `Bearer ${token}`;
        } catch {}
        if (!("Authorization" in headers)) {
          const email = typeof window !== "undefined" ? localStorage.getItem("userEmail") : "";
          if (email) params.set("email", email);
        }

        const res = await fetch(`/api/spedizioni?${params.toString()}`, { headers, cache: "no-store" });
        const j = await res.json().catch(() => ({}));

        if (!alive) return;
        if (j?.ok) {
          const flat: Row[] = (j.rows || []).map((r: any) => ({
            id: r.id,
            _createdTime: r.created_at || null,
            ...r,
          }));
          setRows(flat);
        } else {
          setRows([]);
        }
      } catch {
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
    const arr = !needle
      ? rows
      : rows.filter((r) => {
          const hay = [
            r.human_id,
            r.dest_rs,
            r.dest_citta,
            r.dest_paese,
            r.mittente_rs,
          ]
            .map(norm)
            .join(" | ");
          return hay.includes(needle);
        });

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
      if (sort === "status") {
        const order = (s?: string) => {
          const v = (s || "").toLowerCase();
          if (v.includes("in transito") || v.includes("intransit")) return 2;
          if (v.includes("in consegna") || v.includes("outfordelivery")) return 1;
          if (v.includes("consegn")) return 0;
          if (v.includes("eccez") || v.includes("exception") || v.includes("failed")) return 3;
          return 4;
        };
        return order(a.status) - order(b.status);
      }
      const ca = a._createdTime ? new Date(a._createdTime).getTime() : 0;
      const cb = b._createdTime ? new Date(b._createdTime).getTime() : 0;
      return cb - ca;
    });

    return copy;
  }, [rows, q, sort]);

  return (
    <>
      {/* Toolbar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-slate-400" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Cerca: destinatario, città, paese, ID…"
            className="pl-8 pr-3 py-2 text-sm rounded-lg border bg-white w-72"
          />
        </div>
        <div className="relative">
          <ArrowUpDown className="absolute left-2 top-2.5 h-4 w-4 text-slate-400" />
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as any)}
            className="pl-8 pr-3 py-2 text-sm rounded-lg border bg-white"
            title="Ordina per"
          >
            <option value="created_desc">Data creazione (nuove prima)</option>
            <option value="ritiro_desc">Data ritiro (recenti prima)</option>
            <option value="dest_az">Destinazione A → Z</option>
            <option value="status">Stato</option>
          </select>
        </div>
      </div>

      {/* Lista 1 card per riga */}
      {loading ? (
        <div className="text-sm text-slate-500">Caricamento…</div>
      ) : filtered.length === 0 ? (
        <div className="text-sm text-slate-500">Nessuna spedizione trovata.</div>
      ) : (
        <div className="space-y-3">
          {filtered.map((r) => (
            <Card key={r.id} r={r} onDetails={() => { setSel(r); setOpen(true); }} />
          ))}
        </div>
      )}

      {/* Drawer dettagli */}
      <Drawer open={open} onClose={() => setOpen(false)} title={sel ? (sel.human_id || sel.id) : undefined}>
        {sel ? (
          <div className="space-y-4">
            {/* Mittente / Destinatario */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="rounded-xl border p-4">
                <div className="font-medium text-slate-700 mb-1">Mittente</div>
                <div className="text-sm text-slate-900">{sel.mittente_rs || "—"}</div>
                <div className="text-sm text-slate-600">
                  {[sel.mittente_indirizzo, sel.mittente_cap, sel.mittente_citta, sel.mittente_paese].filter(Boolean).join(", ") || "—"}
                </div>
                <div className="text-sm text-slate-600">Tel: {sel.mittente_telefono || "—"}</div>
                <div className="text-xs text-slate-500">P.IVA/CF: {sel.mittente_piva || "—"}</div>
              </div>
              <div className="rounded-xl border p-4">
                <div className="font-medium text-slate-700 mb-1">Destinatario</div>
                <div className="text-sm text-slate-900">{sel.dest_rs || "—"}</div>
                <div className="text-sm text-slate-600">
                  {[sel.dest_cap, sel.dest_citta, sel.dest_paese].filter(Boolean).join(", ") || "—"}
                </div>
                <div className="text-sm text-slate-600">Tel: {sel.dest_telefono || "—"}</div>
                <div className="text-xs text-slate-500">P.IVA/CF: {sel.dest_piva || "—"}</div>
                <div className="text-xs text-slate-500">Abilitato import: {sel.dest_abilitato_import ? "Sì" : "No"}</div>
              </div>
            </div>

            {/* Ritiro / Incoterm / Tipo */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="rounded-xl border p-4">
                <div className="font-medium text-slate-700 mb-1">Data ritiro</div>
                <div className="text-sm">{sel.giorno_ritiro || "—"}</div>
              </div>
              <div className="rounded-xl border p-4">
                <div className="font-medium text-slate-700 mb-1">Incoterm</div>
                <div className="text-sm">{sel.incoterm || "—"}</div>
              </div>
              <div className="rounded-xl border p-4">
                <div className="font-medium text-slate-700 mb-1">Tipo spedizione</div>
                <div className="text-sm">{sel.tipo_spedizione || "—"}</div>
              </div>
            </div>

            {/* Fatturazione */}
            <div className="rounded-xl border p-4">
              <div className="font-medium text-slate-700 mb-1">Fatturazione</div>
              <div className="text-sm text-slate-900">{sel.fatt_rs || "—"}</div>
              <div className="text-sm text-slate-600">P.IVA/CF: {sel.fatt_piva || "—"}</div>
              <div className="text-sm text-slate-600">Valuta: {sel.fatt_valuta || "—"}</div>
              <div className="text-xs text-slate-500">
                Uguale a Destinatario: {sel.fatt_same_as_dest ? "Sì" : "No"} • Delega fattura a SPST: {sel.fatt_delega ? "Sì" : "No"}
              </div>
            </div>

            {/* Colli */}
            <div className="rounded-xl border p-4">
              <div className="font-medium text-slate-700 mb-2">Colli</div>
              {Array.isArray(sel.packages) && sel.packages.length ? (
                <ul className="text-sm text-slate-700 list-disc ml-4">
                  {sel.packages.map((p:any, i:number) => (
                    <li key={p.id || i}>
                      Collo {i+1}: {p.l1 ?? "?"}×{p.l2 ?? "?"}×{p.l3 ?? "?"} cm — Peso: {p.weight_kg ?? "?"} kg
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="text-sm text-slate-500">Nessun collo disponibile</div>
              )}
            </div>

            {/* Allegati */}
            <div className="rounded-xl border p-4">
              <div className="font-medium text-slate-700 mb-2">Allegati</div>
              {(() => {
                const A = (sel as any)?.attachments || {};
                const Btn = ({ href, label }: { href: string; label: string }) => (
                  <a
                    href={href}
                    target="_blank"
                    className="inline-flex items-center rounded-md bg-[#1c3e5e] px-2.5 py-1.5 text-xs font-medium text-white hover:opacity-95"
                  >
                    {label}
                  </a>
                );
                const items: Array<[keyof typeof A, string]> = [
                  ["ldv", "LDV"],
                  ["fattura_proforma", "Fattura Proforma"],
                  ["fattura_commerciale", "Fattura Commerciale"],
                  ["dle", "DLE"],
                  ["allegato1", "Allegato 1"],
                  ["allegato2", "Allegato 2"],
                  ["allegato3", "Allegato 3"],
                  ["allegato4", "Allegato 4"],
                ];
                const available = items
                  .map(([k, label]) => {
                    const v:any = A?.[k];
                    const url = typeof v === "string" ? v : v?.url;
                    return url ? { url, label } : null;
                  })
                  .filter(Boolean) as { url:string; label:string }[];

                return available.length ? (
                  <div className="flex flex-wrap gap-2">
                    {available.map(x => <Btn key={x.label} href={x.url} label={x.label} />)}
                  </div>
                ) : (
                  <div className="text-sm text-slate-500">Nessun allegato disponibile</div>
                );
              })()}
            </div>
          </div>
        ) : null}
      </Drawer>
    </>
  );
}
