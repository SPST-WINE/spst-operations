// components/backoffice/BackofficeSpedizioniClient.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Search, ArrowUpDown, ExternalLink, Package, Boxes } from "lucide-react";

type ShipmentRow = {
  id: string;
  created_at?: string;
  human_id?: string | null;
  email_cliente?: string | null;
  email_norm?: string | null;

  tipo_spedizione?: string | null;
  incoterm?: string | null;

  mittente_paese?: string | null;
  mittente_citta?: string | null;
  dest_paese?: string | null;
  dest_citta?: string | null;

  colli_n?: number | null;
  formato_sped?: string | null;

  status?: string | null;

  // ✅ NEW: per ricerca tracking (e opzionalmente visualizzazione)
  tracking_code?: string | null;
  carrier?: string | null;
};

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
  return d.toLocaleString("it-IT", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

export default function BackofficeSpedizioniClient() {
  const [rows, setRows] = useState<ShipmentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");

  useEffect(() => {
    let active = true;

    async function load() {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        params.set("sort", "created_desc");
        params.set("limit", "200");

        const res = await fetch(`/api/spedizioni?${params.toString()}`, {
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
        console.error("[BackofficeSpedizioniClient] load error:", e);
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
        r.incoterm,

        // ✅ NEW: tracking + carrier nel filtro
        r.tracking_code,
        r.carrier,
      ]
        .map(norm)
        .join(" | ");

      return hay.includes(needle);
    });
  }, [rows, q]);

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <span className="font-medium text-slate-700">Spedizioni clienti</span>
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
              placeholder="Cerca per ID, email, città, tracking…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="h-9 w-64 rounded-lg border border-slate-200 bg-white pl-8 pr-3 text-xs outline-none placeholder:text-slate-400 focus:border-slate-400"
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
              <th className="px-3 py-2 text-left">Incoterm</th>
              <th className="px-3 py-2 text-left">Stato</th>
              <th className="px-3 py-2 text-left">Creato il</th>
              <th className="px-3 py-2 text-right">Azioni</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-100">
            {loading && rows.length === 0 ? (
              <tr>
                <td colSpan={10} className="px-3 py-6 text-center text-slate-400">
                  Caricamento spedizioni…
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={10} className="px-3 py-6 text-center text-slate-400">
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

                const tracking = (r.tracking_code || "").trim();
                const carrier = (r.carrier || "").trim();
                const trackingLine =
                  tracking && carrier ? `${carrier} · ${tracking}` : tracking ? tracking : null;

                return (
                  <tr key={r.id} className="hover:bg-slate-50/70">
                    <td className="px-3 py-2 align-middle">
                      <div className="flex items-center gap-2">
                        {/* ICONA: pacco grigio | pallet arancione */}
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
                          <span className="text-[11px] text-slate-500">ID interno: {r.id}</span>

                          {/* ✅ NEW (solo UI): mostra tracking sotto, utile anche visivamente */}
                          {trackingLine && (
                            <span className="mt-0.5 text-[11px] text-slate-500">
                              Tracking: <span className="font-medium text-slate-700">{trackingLine}</span>
                            </span>
                          )}
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
                      <span className="text-[11px] text-slate-700">{r.incoterm || "—"}</span>
                    </td>

                    <td className="px-3 py-2 align-middle">
                      <span className="text-[11px] text-slate-700">{r.status || "—"}</span>
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
