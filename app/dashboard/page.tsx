// app/dashboard/page.tsx
"use client";

import Link from "next/link";
import {
  Package,
  Truck,
  AlertTriangle,
  FileText,
  HelpCircle,
  PlusCircle,
  Boxes,
  ArrowRight,
  Calendar,
} from "lucide-react";
import { F } from "@/lib/airtable.schema";
import { format, isToday } from "date-fns";
import { it } from "date-fns/locale";
import { getIdToken } from "@/lib/firebase-client-auth";
import { useEffect, useMemo, useState, useCallback } from "react";

// ------- helpers -------
function norm(val?: string | null) {
  return (val || "").toString().trim();
}

function buildTrackingUrl(carrier?: string | null, code?: string | null) {
  const c = norm(carrier).toLowerCase();
  const n = norm(code);
  if (!c || !n) return null;

  if (c.includes("dhl")) return `https://www.dhl.com/track?tracking-number=${encodeURIComponent(n)}`;
  if (c.includes("ups")) return `https://www.ups.com/track?loc=it_IT&tracknum=${encodeURIComponent(n)}`;
  if (c.includes("fedex")) return `https://www.fedex.com/fedextrack/?trknbr=${encodeURIComponent(n)}`;

  // 👇 TNT: domestico vs internazionale
  if (c.includes("tnt")) {
    const isDomestic = /^MY[0-9A-Z]+$/i.test(n);   // es. "MY09193362"
    if (isDomestic) {
      // Domestiche (Italia) → tnt.it
      return `https://www.tnt.it/tracking/Tracking.do?cons=${encodeURIComponent(n)}`;
    }
    // Internazionali (solo numeri) → tnt.com
    return `https://www.tnt.com/express/it_it/site/shipping-tools/tracking.html?searchType=con&cons=${encodeURIComponent(n)}`;
  }

  if (c.includes("gls")) return `https://gls-group.com/track?match=${encodeURIComponent(n)}`;
  if (c.includes("brt")) return `https://vas.brt.it/vas/sped_numspe_par.htm?sped_num=${encodeURIComponent(n)}`;
  if (c.includes("poste")) return `https://www.poste.it/cerca/index.html#/risultati-spedizioni/${encodeURIComponent(n)}`;
  if (c.includes("sda")) return `https://www.sda.it/wps/portal/Servizi_online/ricerca_spedizioni?locale=it&tracing-codes=${encodeURIComponent(n)}`;

  return null;
}


const ACTIVE_STATES = new Set([
  "In elaborazione",
  "In transito",
  "In consegna",
  "Pending",
  "InfoReceived",
  "InTransit",
  "OutForDelivery",
  "Exception",
  "FailedAttempt",
  "Unknown",
]);

type Row = { id: string; fields: Record<string, any>; _createdTime?: string };

// Attende il token Firebase con piccoli retry (utile all’avvio della pagina)
async function ensureAuthToken(maxAttempts = 8, delayMs = 250): Promise<string | null> {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const t = await getIdToken();
      if (t) return t;
    } catch {}
    await new Promise((r) => setTimeout(r, delayMs));
  }
  return null;
}

export default function DashboardOverview() {
  const [email, setEmail] = useState<string | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchRows = useCallback(async () => {
    setLoading(true);
    try {
      const e = localStorage.getItem("userEmail") || null;
      setEmail(e);

      // Se non ho email locale, provo a ottenere il token (con retry) per far filtrare il server
      const token = e ? await getIdToken().catch(() => null) : await ensureAuthToken();

      // Se mancano sia email che token → non faccio la fetch (evita dati di altri)
      if (!e && !token) {
        setRows([]);
        setLoading(false);
        return;
      }

      const qs = new URLSearchParams({
        ...(e ? { email: e } : {}), // se c’è email locale la passo sempre
        sort: "ritiro_desc",
      });

      const res = await fetch(`/api/spedizioni?${qs.toString()}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });

      if (!res.ok) {
        setRows([]);
        setLoading(false);
        return;
      }

      const json = await res.json();
      const data: Row[] = Array.isArray(json) ? json : json.rows ?? [];
      setRows(data);
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Prima lettura
    fetchRows();

    // ricarica quando cambia userEmail (al login in un’altra tab)
    const onStorage = (ev: StorageEvent) => {
      if (ev.key === "userEmail") fetchRows();
    };
    window.addEventListener("storage", onStorage);

    // ricarica al focus (es. token diventato disponibile)
    const onFocus = () => fetchRows();
    window.addEventListener("focus", onFocus);

    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("focus", onFocus);
    };
  }, [fetchRows]);

  // KPI
  const { inCorso, inConsegnaOggi } = useMemo(() => {
  const inCorso = rows.filter((r) =>
    ACTIVE_STATES.has(
      norm(
        (r.fields?.["Stato"] as string) ||
          (r.fields?.["Tracking Status"] as string) ||
          ""
      )
    )
  ).length;

  const inConsegnaOggi = rows.filter((r) => {
    const stato = norm(
      (r.fields?.["Stato"] as string) ||
        (r.fields?.["Tracking Status"] as string) ||
        ""
    );

    const etaStr = r.fields?.["ETA"] as string | undefined;
    const eta = etaStr ? new Date(etaStr) : null;

    // consideriamo "in consegna" oppure ETA oggi
    if (stato.includes("in consegna") || stato.toLowerCase().includes("outfordelivery")) {
      return true;
    }
    if (!eta || Number.isNaN(eta.getTime())) return false;
    return isToday(eta);
  }).length;

  return { inCorso, inConsegnaOggi };
}, [rows]);


  const kpi = [
    { label: "Spedizioni in corso", value: String(inCorso), icon: Truck },
    { label: "In consegna oggi", value: String(inConsegnaOggi), icon: Package },
    { label: "Azioni richieste", value: "0", icon: AlertTriangle },
  ] as const;

  // Tracking items
  const trackingItems = useMemo(() => {
  const items = rows
    .filter((r) =>
      ACTIVE_STATES.has(
        norm(
          (r.fields?.["Stato"] as string) ||
            (r.fields?.["Tracking Status"] as string) ||
            ""
        )
      )
    )
    .slice(0, 10)
    .map((r) => {
      const f = (r.fields || {}) as Record<string, any>;

      const destCity = (f[F.D_CITTA] as string) || f["Destinatario - Città"] || "";
      const destCountry =
        (f[F.D_PAESE] as string) || f["Destinatario - Paese"] || "";
      const stato = (f[F.Stato] as string) || f["Stato"] || "—";

      const carrier =
        (typeof f[F.Corriere] === "string" && f[F.Corriere]) || undefined;
      const code =
        (typeof f[F.TrackingNumber] === "string" && f[F.TrackingNumber]) ||
        undefined;
      const url =
        (f[F.TrackingURL] as string) || buildTrackingUrl(carrier, code);

      const labelDest = [destCity, destCountry]
        .filter(Boolean)
        .join(" (")
        .concat(destCountry ? ")" : "");

      const ref =
        (f[F.ID_Spedizione] as string) ||
        (f["ID Spedizione"] as string) ||
        (f["ID SPST"] as string) ||
        (f["ID Spedizione (custom)"] as string) ||
        r.id;

      return {
        id: r.id,
        ref,
        dest: labelDest,
        stato,
        url,
      };
    });

  return items;
}, [rows]);


  // Ritiri programmati
  const ritiri = useMemo(() => {
    return rows
      .map((r) => {
        const d = r.fields["Ritiro - Data"] ? new Date(r.fields["Ritiro - Data"]) : null;
        const city = r.fields["Destinatario - Città"] || "";
        const country = r.fields["Destinatario - Paese"] || "";
        return { id: r.id, date: d, city, country };
      })
      .filter((r) => r.date && r.date >= new Date(new Date().toDateString()))
      .sort((a, b) => a.date!.getTime() - b.date!.getTime())
      .slice(0, 5);
  }, [rows]);

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-semibold text-slate-800">Overview</h1>
        <p className="text-slate-500 text-sm mt-1">
          Riepilogo account, azioni rapide e tracking.
          {email ? null : " (accedi per vedere le tue spedizioni)"}
        </p>
      </header>

      {/* KPI */}
      <section>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {kpi.map(({ label, value, icon: Icon }) => (
            <div key={label} className="rounded-2xl border bg-white p-4">
              <div className="flex items-center gap-3">
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-[#1c3e5e]/10 text-[#1c3e5e]">
                  <Icon className="h-5 w-5" />
                </span>
                <div>
                  <div className="text-xs uppercase tracking-wide text-slate-500">{label}</div>
                  <div className="text-xl font-semibold text-slate-900">
                    {loading ? "…" : value}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Azioni rapide */}
      <section>
        <h3 className="mb-3 text-sm font-semibold text-[#f7911e]">Azioni rapide</h3>
        <div className="grid gap-4 md:grid-cols-3">
          <Link href="/dashboard/nuova/vino" className="group rounded-2xl border bg-white p-4 hover:shadow-md transition">
            <div className="flex items-start gap-3">
              <span className="rounded-xl bg-[#1c3e5e]/10 p-2 text-[#1c3e5e]"><PlusCircle className="h-5 w-5" /></span>
              <div>
                <div className="font-medium text-slate-900">Spedizione vino</div>
                <p className="text-sm text-slate-500">Dati completi, fatture e packing list.</p>
              </div>
            </div>
          </Link>

          <Link href="/dashboard/nuova/altro" className="group rounded-2xl border bg-white p-4 hover:shadow-md transition">
            <div className="flex items-start gap-3">
              <span className="rounded-xl bg-[#1c3e5e]/10 p-2 text-[#1c3e5e]"><Boxes className="h-5 w-5" /></span>
              <div>
                <div className="font-medium text-slate-900">Altre spedizioni</div>
                <p className="text-sm text-slate-500">Materiali, brochure e non accise.</p>
              </div>
            </div>
          </Link>

          <Link href="/dashboard/informazioni-utili" className="group rounded-2xl border bg-white p-4 hover:shadow-md transition">
            <div className="flex items-start gap-3">
              <span className="rounded-xl bg-[#1c3e5e]/10 p-2 text-[#1c3e5e]"><FileText className="h-5 w-5" /></span>
              <div>
                <div className="font-medium text-slate-900">Documenti utili</div>
                <p className="text-sm text-slate-500">Guide pallet/pacchi, compliance e FAQ.</p>
              </div>
            </div>
          </Link>
        </div>
      </section>

      {/* Tracking a tutta riga */}
      <section>
        <div className="rounded-2xl border bg-white p-4">
          <h3 className="mb-3 text sm font-semibold text-[#f7911e]">Tracking spedizioni</h3>
          {loading ? (
            <p className="text-sm text-slate-500">Caricamento…</p>
          ) : trackingItems.length === 0 ? (
            <p className="text-sm text-slate-500">Nessuna spedizione in corso.</p>
          ) : (
            <div className="divide-y">
              {trackingItems.map((row) => (
                <div key={row.id} className="py-3 flex items-center justify-between">
                  <div className="flex items-start gap-3">
                    <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-700">
                      <Package className="h-4 w-4" />
                    </span>
                    <div>
                      <div className="font-medium text-slate-900">{row.ref}</div>
                      <div className="text-sm text-slate-500">{row.dest || "—"} · {row.stato}</div>
                    </div>
                  </div>
                  {row.url ? (
                    <a className="inline-flex items-center gap-1 text-[#1c3e5e] hover:underline text-sm" href={row.url} target="_blank" rel="noopener noreferrer">
                      Apri tracking <ArrowRight className="h-4 w-4" />
                    </a>
                  ) : (
                    <span className="text-sm text-slate-400">N/D</span>
                  )}
                </div>
              ))}
            </div>
          )}
          <div className="mt-3 text-right">
            <Link href="/dashboard/spedizioni" className="inline-flex items-center gap-1 text-[#1c3e5e] hover:underline text-sm">
              Vedi tutte <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* Supporto + Ritiri */}
      <section className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border bg-white p-4">
          <h3 className="mb-3 text-sm font-semibold text-[#f7911e]">Supporto</h3>
          <p className="text-sm text-slate-600">Hai bisogno di aiuto? Siamo a disposizione per domande su compliance, documenti e tracking.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Link href="/dashboard/informazioni-utili" className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm text-[#1c3e5e] hover:bg-slate-50">
              <FileText className="h-4 w-4" /> Documenti utili
            </Link>
            <Link href="https://wa.me/message/CP62RMFFDNZPO1" target="_blank" className="inline-flex items-center gap-2 rounded-lg bg-[#f7911e] px-3 py-2 text-sm text-white hover:opacity-95">
              <HelpCircle className="h-4 w-4" /> WhatsApp
            </Link>
          </div>
        </div>

        <div className="rounded-2xl border bg-white p-4">
          <h3 className="mb-3 text-sm font-semibold text-[#f7911e]">Ritiri programmati</h3>
          {!loading && ritiri.length === 0 ? (
            <p className="text-sm text-slate-500">Nessun ritiro programmato.</p>
          ) : (
            <ul className="space-y-3 text-sm">
              {ritiri.map((r) => (
                <li key={r.id} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-[#1c3e5e]" />
                    <span>
                      {format(r.date!, "d MMMM yyyy", { locale: it })} – {r.city} {r.country ? `(${r.country})` : ""}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}
