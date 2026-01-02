// app/dashboard/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Package,
  Truck,
  FileText,
  PlusCircle,
  Boxes,
  ArrowRight,
  Calendar,
  CheckCircle2,
  FileCheck,
  Clock,
} from "lucide-react";
import { format, isToday, isFuture, parseISO } from "date-fns";
import { it } from "date-fns/locale";

type ShipmentRow = {
  id: string;
  human_id?: string | null;
  created_at?: string | null;
  status?: string | null;
  carrier?: string | null;
  tracking_code?: string | null;
  giorno_ritiro?: string | null;
  dest_citta?: string | null;
  dest_paese?: string | null;
  attachments?: {
    ldv?: { url?: string | null } | null;
    fattura_proforma?: { url?: string | null } | null;
    fattura_commerciale?: { url?: string | null } | null;
    dle?: { url?: string | null } | null;
    allegato1?: { url?: string | null } | null;
    allegato2?: { url?: string | null } | null;
    allegato3?: { url?: string | null } | null;
    allegato4?: { url?: string | null } | null;
  };
};

type QuoteRow = {
  id: string;
  status?: string | null;
  createdAt?: string | null;
  destinatario?: {
    ragioneSociale?: string | null;
    citta?: string | null;
    paese?: string | null;
  } | null;
};

function normalizeCarrierKey(carrier?: string | null): string {
  return (carrier || "").trim().toLowerCase();
}

function getTrackingUrl(carrier?: string | null, tracking?: string | null): string | null {
  const trk = (tracking || "").trim();
  if (!trk) return null;

  const c = normalizeCarrierKey(carrier);

  if (c.includes("fedex")) {
    return `https://www.fedex.com/fedextrack/?trknbr=${encodeURIComponent(trk)}`;
  }
  if (c.includes("ups")) {
    return `https://wwwapps.ups.com/WebTracking/track?track=yes&trackNums=${encodeURIComponent(trk)}`;
  }
  if (c.includes("dhl")) {
    return `https://www.dhl.com/global-en/home/tracking.html?tracking-id=${encodeURIComponent(trk)}`;
  }
  if (c.includes("tnt")) {
    const trkUp = trk.toUpperCase();
    if (trkUp.startsWith("MY")) {
      return `https://www.tnt.it/tracking/Tracking.do?cons=${encodeURIComponent(trk)}`;
    }
    const onlyDigits = /^\d+$/.test(trk);
    if (onlyDigits) {
      return `https://www.tnt.com/express/it_it/site/shipping-tools/tracking.html?searchType=con&cons=${encodeURIComponent(trk)}`;
    }
    return `https://www.tnt.com/express/it_it/site/shipping-tools/tracking.html?searchType=con&cons=${encodeURIComponent(trk)}`;
  }
  if (c.includes("gls")) {
    return `https://gls-group.com/track?match=${encodeURIComponent(trk)}`;
  }
  if (c.includes("brt")) {
    return `https://vas.brt.it/vas/sped_numspe_par.htm?sped_num=${encodeURIComponent(trk)}`;
  }
  if (c.includes("poste")) {
    return `https://www.poste.it/cerca/index.html#/risultati-spedizioni/${encodeURIComponent(trk)}`;
  }
  if (c.includes("sda")) {
    return `https://www.sda.it/wps/portal/Servizi_online/ricerca_spedizioni?locale=it&tracing-codes=${encodeURIComponent(trk)}`;
  }

  // fallback: ricerca google
  const q = `${(carrier || "tracking").toString()} ${trk}`;
  return `https://www.google.com/search?q=${encodeURIComponent(q)}`;
}

type EventType = {
  id: string;
  type:
    | "shipment_created"
    | "shipment_documents_received"
    | "shipment_picked_up"
    | "shipment_delivered"
    | "quote_sent"
    | "quote_received"
    | "quote_accepted";
  title: string;
  description: string;
  date: Date;
  link?: string;
  refId?: string; // ID da mostrare a destra (SP... per spedizioni, UUID per quotazioni)
};

export default function DashboardOverview() {
  const [shipments, setShipments] = useState<ShipmentRow[]>([]);
  const [quotes, setQuotes] = useState<QuoteRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    async function load() {
    setLoading(true);
    try {
        // Carica spedizioni
        const shipRes = await fetch("/api/spedizioni?limit=100", {
          cache: "no-store",
        });
        const shipData = await shipRes.json().catch(() => ({}));
        const shipRows: ShipmentRow[] = shipData?.ok && Array.isArray(shipData.rows) ? shipData.rows : [];

        // Carica quotazioni
        const quoteRes = await fetch("/api/quotazioni", {
          cache: "no-store",
      });
        const quoteData = await quoteRes.json().catch(() => ({}));
        const quoteRows: QuoteRow[] = quoteData?.ok && Array.isArray(quoteData.rows) ? quoteData.rows : [];

        if (!active) return;

        setShipments(shipRows);
        setQuotes(quoteRows);
      } catch (e) {
        console.error("[Dashboard] load error:", e);
        if (active) {
          setShipments([]);
          setQuotes([]);
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    load();
    return () => {
      active = false;
    };
  }, []);

  // KPI
  const { inCorso, consegnate } = useMemo(() => {
    const inCorso = shipments.filter(
      (s) =>
        s.status &&
        !["CONSEGNATA", "ANNULLATA"].includes(s.status.toUpperCase())
  ).length;

    const consegnate = shipments.filter(
      (s) => s.status && s.status.toUpperCase() === "CONSEGNATA"
    ).length;

    return { inCorso, consegnate };
  }, [shipments]);

  // Tracking items (spedizioni in corso con tracking)
  const trackingItems = useMemo(() => {
    return shipments
      .filter(
        (s) =>
          s.status &&
          !["CONSEGNATA", "ANNULLATA"].includes(s.status.toUpperCase()) &&
          s.tracking_code
    )
      .slice(0, 5)
      .map((s) => {
        const url = getTrackingUrl(s.carrier, s.tracking_code);
        const dest = [s.dest_citta, s.dest_paese].filter(Boolean).join(", ");
      return {
          id: s.id,
          ref: s.human_id || s.id,
          dest: dest || "—",
          status: s.status || "—",
        url,
      };
    });
  }, [shipments]);

  // Ritiri programmati
  const ritiri = useMemo(() => {
    return shipments
      .filter((s) => s.giorno_ritiro)
      .map((s) => {
        try {
          const date = parseISO(s.giorno_ritiro!);
          if (isFuture(date) || isToday(date)) {
            return {
              id: s.id,
              date,
              ref: s.human_id || s.id,
              dest: [s.dest_citta, s.dest_paese].filter(Boolean).join(", ") || "—",
            };
          }
        } catch {}
        return null;
      })
      .filter((r): r is NonNullable<typeof r> => r !== null)
      .sort((a, b) => a.date.getTime() - b.date.getTime())
      .slice(0, 5);
  }, [shipments]);

  // Eventi (notifiche)
  const eventi = useMemo(() => {
    const events: EventType[] = [];

    // 1. Hai creato una spedizione
    shipments.forEach((s) => {
      try {
        const date = s.created_at ? parseISO(s.created_at) : new Date();
        events.push({
          id: `shipment-created-${s.id}`,
          type: "shipment_created",
          title: "Hai creato una spedizione",
          description: s.dest_citta ? `Spedizione per ${s.dest_citta}` : "Spedizione creata",
          date,
          link: `/dashboard/spedizioni/${s.id}`,
          refId: s.human_id || s.id,
        });
      } catch {}
    });

    // 2. Hai ricevuto i documenti per una spedizione (status IN RITIRO con documenti)
    shipments
      .filter((s) => {
        const status = (s.status || "").toUpperCase();
        if (status !== "IN RITIRO") return false;
        const att = s.attachments || {};
        return !!(
          att.ldv?.url ||
          att.fattura_proforma?.url ||
          att.fattura_commerciale?.url ||
          att.dle?.url ||
          att.allegato1?.url ||
          att.allegato2?.url ||
          att.allegato3?.url ||
          att.allegato4?.url
        );
      })
      .forEach((s) => {
        try {
          // Usa created_at come approssimazione (in realtà i documenti arrivano dopo)
          const date = s.created_at ? parseISO(s.created_at) : new Date();
          events.push({
            id: `shipment-docs-${s.id}`,
            type: "shipment_documents_received",
            title: "Hai ricevuto i documenti per una spedizione",
            description: s.dest_citta ? `Documenti disponibili per ${s.dest_citta}` : "Documenti disponibili",
            date,
            link: `/dashboard/spedizioni/${s.id}`,
            refId: s.human_id || s.id,
          });
        } catch {}
      });

    // 3. La tua spedizione è stata ritirata (status IN TRANSITO)
    shipments
      .filter((s) => (s.status || "").toUpperCase() === "IN TRANSITO")
      .forEach((s) => {
        try {
          const date = s.created_at ? parseISO(s.created_at) : new Date();
          events.push({
            id: `shipment-picked-${s.id}`,
            type: "shipment_picked_up",
            title: "La tua spedizione è stata ritirata",
            description: s.dest_citta ? `Spedizione in transito per ${s.dest_citta}` : "Spedizione in transito",
            date,
            link: `/dashboard/spedizioni/${s.id}`,
            refId: s.human_id || s.id,
          });
        } catch {}
      });

    // 4. La tua spedizione è stata consegnata (status CONSEGNATA)
    shipments
      .filter((s) => (s.status || "").toUpperCase() === "CONSEGNATA")
      .forEach((s) => {
        try {
          const date = s.created_at ? parseISO(s.created_at) : new Date();
          events.push({
            id: `shipment-delivered-${s.id}`,
            type: "shipment_delivered",
            title: "La tua spedizione è stata consegnata",
            description: s.dest_citta ? `Spedizione consegnata a ${s.dest_citta}` : "Spedizione consegnata",
            date,
            link: `/dashboard/spedizioni/${s.id}`,
            refId: s.human_id || s.id,
          });
        } catch {}
      });

    // 5. Hai inviato una quotazione (status IN LAVORAZIONE)
    quotes
      .filter((q) => (q.status || "").toUpperCase() === "IN LAVORAZIONE")
      .forEach((q) => {
        try {
          const date = q.createdAt ? parseISO(q.createdAt) : new Date();
          events.push({
            id: `quote-sent-${q.id}`,
            type: "quote_sent",
            title: "Hai inviato una quotazione",
            description: q.destinatario?.citta ? `Richiesta di quotazione per ${q.destinatario.citta}` : "Richiesta di quotazione",
            date,
            link: `/dashboard/quotazioni/${q.id}`,
            refId: q.id,
          });
        } catch {}
      });

    // 6. Hai ricevuto la tua quotazione (status DISPONIBILE)
    quotes
      .filter((q) => (q.status || "").toUpperCase() === "DISPONIBILE")
      .forEach((q) => {
        try {
          const date = q.createdAt ? parseISO(q.createdAt) : new Date();
          events.push({
            id: `quote-received-${q.id}`,
            type: "quote_received",
            title: "Hai ricevuto la tua quotazione",
            description: q.destinatario?.citta ? `Quotazione disponibile per ${q.destinatario.citta}` : "Quotazione disponibile",
            date,
            link: `/dashboard/quotazioni/${q.id}`,
            refId: q.id,
          });
        } catch {}
      });

    // 7. Hai accettato la quotazione (status ACCETTATA)
    quotes
      .filter((q) => (q.status || "").toUpperCase() === "ACCETTATA")
      .forEach((q) => {
        try {
          const date = q.createdAt ? parseISO(q.createdAt) : new Date();
          events.push({
            id: `quote-accepted-${q.id}`,
            type: "quote_accepted",
            title: "Hai accettato la quotazione",
            description: q.destinatario?.citta ? `Quotazione accettata per ${q.destinatario.citta}` : "Quotazione accettata",
            date,
            link: `/dashboard/quotazioni/${q.id}`,
            refId: q.id,
          });
        } catch {}
      });

    // Ordina per data (più recenti prima) e limita a 20 per mostrare più eventi
    return events
      .sort((a, b) => b.date.getTime() - a.date.getTime())
      .slice(0, 20);
  }, [shipments, quotes]);

  const getEventIcon = (type: EventType["type"]) => {
    switch (type) {
      case "quote_sent":
      case "quote_received":
      case "quote_accepted":
        return FileText;
      case "shipment_created":
      case "shipment_picked_up":
      case "shipment_delivered":
        return Package;
      case "shipment_documents_received":
        return FileCheck;
      default:
        return Clock;
    }
  };

  const getEventColor = (type: EventType["type"]) => {
    switch (type) {
      case "quote_sent":
        return "bg-blue-50 text-blue-700";
      case "quote_received":
        return "bg-purple-50 text-purple-700";
      case "quote_accepted":
        return "bg-emerald-50 text-emerald-700";
      case "shipment_created":
        return "bg-slate-50 text-slate-700";
      case "shipment_documents_received":
        return "bg-amber-50 text-amber-700";
      case "shipment_picked_up":
        return "bg-sky-50 text-sky-700";
      case "shipment_delivered":
        return "bg-emerald-50 text-emerald-700";
      default:
        return "bg-slate-50 text-slate-700";
    }
  };

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-semibold text-slate-800">Overview</h1>
        <p className="text-slate-500 text-sm mt-1">
          Riepilogo account, azioni rapide e tracking.
        </p>
      </header>

      {/* KPI */}
      <section>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-2xl border bg-white p-4">
              <div className="flex items-center gap-3">
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-sky-50 text-sky-700">
                <Truck className="h-5 w-5" />
                </span>
                <div>
                <div className="text-xs uppercase tracking-wide text-slate-500">
                  Spedizioni in corso
                </div>
                  <div className="text-xl font-semibold text-slate-900">
                  {loading ? "…" : inCorso}
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border bg-white p-4">
            <div className="flex items-center gap-3">
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
                <CheckCircle2 className="h-5 w-5" />
              </span>
              <div>
                <div className="text-xs uppercase tracking-wide text-slate-500">
                  Spedizioni consegnate
                  </div>
                <div className="text-xl font-semibold text-slate-900">
                  {loading ? "…" : consegnate}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Azioni rapide */}
      <section>
        <h3 className="mb-3 text-sm font-semibold text-[#f7911e]">Azioni rapide</h3>
        <div className="grid gap-4 md:grid-cols-3">
          <Link
            href="/dashboard/nuova/vino"
            className="group rounded-2xl border bg-white p-4 hover:shadow-md transition"
          >
            <div className="flex items-start gap-3">
              <span className="rounded-xl bg-[#1c3e5e]/10 p-2 text-[#1c3e5e]">
                <PlusCircle className="h-5 w-5" />
              </span>
              <div>
                <div className="font-medium text-slate-900">Crea spedizione</div>
                <p className="text-sm text-slate-500">
                  Vino o altre merci. Dati completi, fatture e packing list.
                </p>
              </div>
            </div>
          </Link>

          <Link
            href="/dashboard/quotazioni/nuova"
            className="group rounded-2xl border bg-white p-4 hover:shadow-md transition"
          >
            <div className="flex items-start gap-3">
              <span className="rounded-xl bg-[#1c3e5e]/10 p-2 text-[#1c3e5e]">
                <FileText className="h-5 w-5" />
              </span>
              <div>
                <div className="font-medium text-slate-900">Richiedi quotazione</div>
                <p className="text-sm text-slate-500">
                  Richiedi un preventivo per la tua spedizione.
                </p>
              </div>
            </div>
          </Link>

          <Link
            href="/dashboard/informazioni-utili"
            className="group rounded-2xl border bg-white p-4 hover:shadow-md transition"
          >
            <div className="flex items-start gap-3">
              <span className="rounded-xl bg-[#1c3e5e]/10 p-2 text-[#1c3e5e]">
                <FileText className="h-5 w-5" />
              </span>
              <div>
                <div className="font-medium text-slate-900">Documenti utili</div>
                <p className="text-sm text-slate-500">
                  Guide pallet/pacchi, compliance e FAQ.
                </p>
              </div>
            </div>
          </Link>
        </div>
      </section>

      {/* Tracking e Ritiri */}
      <section className="grid gap-6 lg:grid-cols-2">
        {/* Tracking */}
        <div className="rounded-2xl border bg-white p-4">
          <h3 className="mb-3 text-sm font-semibold text-[#f7911e]">Tracking spedizioni</h3>
          {loading ? (
            <p className="text-sm text-slate-500">Caricamento…</p>
          ) : trackingItems.length === 0 ? (
            <p className="text-sm text-slate-500">Nessuna spedizione in corso con tracking.</p>
          ) : (
            <div className="divide-y">
              {trackingItems.map((item) => (
                <div key={item.id} className="py-3 flex items-center justify-between">
                  <div className="flex items-start gap-3">
                    <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-700">
                      <Package className="h-4 w-4" />
                    </span>
                    <div>
                      <div className="font-medium text-slate-900">{item.ref}</div>
                      <div className="text-sm text-slate-500">
                        {item.dest} · {item.status}
                      </div>
                    </div>
                  </div>
                  {item.url ? (
                    <a
                      className="inline-flex items-center gap-1 text-[#1c3e5e] hover:underline text-sm"
                      href={item.url}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
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
            <Link
              href="/dashboard/spedizioni"
              className="inline-flex items-center gap-1 text-[#1c3e5e] hover:underline text-sm"
            >
              Vedi tutte <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>

        {/* Ritiri programmati */}
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
                      {format(r.date, "d MMMM yyyy", { locale: it })} – {r.dest}
                    </span>
                  </div>
                  <Link
                    href={`/dashboard/spedizioni/${r.id}`}
                    className="text-[#1c3e5e] hover:underline text-xs"
                  >
                    {r.ref}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {/* Eventi */}
      <section>
        <div className="rounded-2xl border bg-white p-4">
          <h3 className="mb-3 text-sm font-semibold text-[#f7911e]">Eventi recenti</h3>
          {loading ? (
            <p className="text-sm text-slate-500">Caricamento…</p>
          ) : eventi.length === 0 ? (
            <p className="text-sm text-slate-500">Nessun evento recente.</p>
          ) : (
            <div className="space-y-3">
              {eventi.map((event) => {
                const Icon = getEventIcon(event.type);
                const colorClass = getEventColor(event.type);
                const content = (
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <span
                        className={`inline-flex h-8 w-8 items-center justify-center rounded-lg ${colorClass} flex-shrink-0`}
                      >
                        <Icon className="h-4 w-4" />
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-slate-900">{event.title}</div>
                        <div className="text-sm text-slate-500">{event.description}</div>
                        <div className="text-xs text-slate-400 mt-1">
                          {format(event.date, "d MMMM yyyy 'alle' HH:mm", { locale: it })}
                        </div>
                      </div>
                    </div>
                    {event.refId && (
                      <div className="flex-shrink-0 text-xs font-mono text-slate-400">
                        {event.refId}
                      </div>
                    )}
                  </div>
                );

                if (event.link) {
                  return (
                    <Link
                      key={event.id}
                      href={event.link}
                      target={event.link.startsWith("http") ? "_blank" : undefined}
                      rel={event.link.startsWith("http") ? "noopener noreferrer" : undefined}
                      className="block py-2 hover:bg-slate-50 rounded-lg transition"
                    >
                      {content}
                    </Link>
                  );
                }

                return (
                  <div key={event.id} className="py-2">
                    {content}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
