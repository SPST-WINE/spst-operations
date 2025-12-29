// components/backoffice/BackofficeShipmentDetailClient.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Loader2, Mail, CheckCircle2, FileText, Package } from "lucide-react";
import type {
  AttachmentInfo,
  PackageRow,
  ShipmentDetailFlat,
} from "@/lib/backoffice/normalizeShipmentDetail";
import { normalizeShipmentDTOToFlat } from "@/lib/backoffice/normalizeShipmentDetail";

type ShipmentDetail = ShipmentDetailFlat;

type Props = { id: string };

function formatDateTime(s?: string | null) {
  if (!s) return "—";
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("it-IT", { dateStyle: "short", timeStyle: "short" });
}

function formatDate(s?: string | null) {
  if (!s) return "—";
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return s;
  return d.toLocaleDateString("it-IT");
}

function formatWeightKg(n?: number | null) {
  if (typeof n !== "number") return "—";
  return `${n.toFixed(2)} kg`;
}

function InfoRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex justify-between gap-4 text-xs">
      <span className="text-slate-500">{label}</span>
      <span className="max-w-[60%] text-right text-slate-800">
        {value && value.trim() !== "" ? value : "—"}
      </span>
    </div>
  );
}

function AttachmentRow({
  label,
  att,
  type,
  shipmentId,
  onUploaded,
}: {
  label: string;
  att?: AttachmentInfo;
  type: string;
  shipmentId: string;
  onUploaded: (url: string) => void;
}) {
  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append("file", file);
    formData.append("type", type);

    const res = await fetch(`/api/spedizioni/${shipmentId}/upload`, {
      method: "POST",
      body: formData,
    });

    const json = await res.json();

    if (json.ok) {
      onUploaded(json.url);
    } else {
      alert("Errore upload: " + json.error);
    }
  }

  const hasFile = !!att?.url;

  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-dashed border-slate-200 bg-slate-50 px-3 py-2.5 text-xs">
      <div className="flex items-center gap-2">
        <FileText className="h-3.5 w-3.5 text-slate-500" />
        <div className="flex flex-col">
          <span className="font-medium text-slate-700">{label}</span>
          <span className="text-[11px] text-slate-500">
            {hasFile ? att?.file_name : "Nessun file caricato"}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {hasFile && (
          <Link
            href={att!.url}
            target="_blank"
            className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] text-slate-700 hover:bg-slate-50"
          >
            Apri
          </Link>
        )}

        <label className="cursor-pointer rounded-lg bg-slate-900 px-2.5 py-1 text-[11px] text-white hover:bg-slate-800">
          Carica
          <input type="file" className="hidden" onChange={handleUpload} />
        </label>
      </div>
    </div>
  );
}

/* ───────────────── helpers robusti per fallback da fields ───────────────── */

const toNum = (v: any): number | null => {
  if (v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

const pickStr = (...vals: any[]): string | null => {
  for (const v of vals) {
    if (typeof v === "string" && v.trim() !== "") return v;
  }
  return null;
};

const pickBool = (...vals: any[]): boolean | null => {
  for (const v of vals) {
    if (typeof v === "boolean") return v;
  }
  return null;
};

const mapPartyFromFields = (obj: any) => {
  if (!obj || typeof obj !== "object") return null;
  return {
    rs: pickStr(obj.ragioneSociale, obj.rs, obj.nome, obj.company),
    paese: pickStr(obj.paese, obj.country),
    citta: pickStr(obj.citta, obj.city),
    cap: pickStr(obj.cap, obj.zip, obj.postcode),
    indirizzo: pickStr(obj.indirizzo, obj.address, obj.street),
    telefono: pickStr(obj.telefono, obj.phone),
    piva: pickStr(obj.piva, obj.vat, obj.taxid, obj.tax_id),
  };
};

const mapColliToPackages = (arr: any[]): PackageRow[] => {
  // support:
  // - Collo: {lunghezza_cm, larghezza_cm, altezza_cm, peso_kg}
  // - PackageRow-like: {l1,l2,l3,weight_kg}
  return arr
    .map((x: any, idx: number) => {
      if (!x || typeof x !== "object") return null;

      const l1 =
        toNum(x.l1) ??
        toNum(x.length_cm) ??
        toNum(x.lunghezza_cm) ??
        toNum(x.lato1) ??
        toNum(x.L1) ??
        null;

      const l2 =
        toNum(x.l2) ??
        toNum(x.width_cm) ??
        toNum(x.larghezza_cm) ??
        toNum(x.lato2) ??
        toNum(x.L2) ??
        null;

      const l3 =
        toNum(x.l3) ??
        toNum(x.height_cm) ??
        toNum(x.altezza_cm) ??
        toNum(x.lato3) ??
        toNum(x.L3) ??
        null;

      const w =
        toNum(x.weight_kg) ??
        toNum(x.peso_kg) ??
        toNum(x.peso) ??
        toNum(x.weight) ??
        null;

      // se è completamente vuoto, scarta
      if (l1 === null && l2 === null && l3 === null && w === null) return null;

      return { id: x.id ?? String(idx), l1, l2, l3, weight_kg: w } as PackageRow;
    })
    .filter(Boolean) as PackageRow[];
};

export default function BackofficeShipmentDetailClient({ id }: Props) {
  const [data, setData] = useState<ShipmentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // stato per corriere + tracking
  const [carrierEdit, setCarrierEdit] = useState("");
  const [trackingEdit, setTrackingEdit] = useState("");
  const [savingTracking, setSavingTracking] = useState(false);
  const [trackingMsg, setTrackingMsg] = useState<string | null>(null);

  // stato per verifica email azioni
  const [emailConfirm, setEmailConfirm] = useState("");
  const [sendingEmail, setSendingEmail] = useState(false);
  const [emailMsg, setEmailMsg] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/spedizioni/${id}`, { cache: "no-store" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const json = await res.json();
        if (!active) return;

       if (json?.ok && json.shipment) {
  // ✅ API returns the canonical ShipmentDTO (nested). The backoffice page
  // expects a flat, render-friendly shape -> normalize here.
  const s = normalizeShipmentDTOToFlat(json.shipment);
  setData(s as ShipmentDetail);
  setCarrierEdit(s.carrier || "");
  setTrackingEdit(s.tracking_code || "");
} else {
  throw new Error("Risposta API non valida");
}
      } catch (e: any) {
        console.error("[BackofficeShipmentDetail] load error:", e);
        if (active) {
          setError("Impossibile caricare i dati della spedizione.");
          setData(null);
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    load();
    return () => {
      active = false;
    };
  }, [id]);

  /* ─────────────────────────────
     MERGE “solido” (data + fields)
     ───────────────────────────── */
  const merged = useMemo(() => {
    if (!data) return null;

    const fieldsAny: any = (data as any).fields || {};

    // party fallback da fields
    const fMitt = mapPartyFromFields(fieldsAny.mittente);
    const fDest = mapPartyFromFields(fieldsAny.destinatario);
    const fFattRaw =
      fieldsAny.fattSameAsDest === true
        ? fieldsAny.destinatario
        : fieldsAny.fatturazione;
    const fFatt = mapPartyFromFields(fFattRaw);

    // packages fallback da fields
    const rawPkgs =
      (Array.isArray(fieldsAny.colli) && fieldsAny.colli) ||
      (Array.isArray(fieldsAny.packages) && fieldsAny.packages) ||
      (Array.isArray(fieldsAny.parcels) && fieldsAny.parcels) ||
      null;

    const pkgsFromFields = rawPkgs ? mapColliToPackages(rawPkgs) : [];

    const effectivePackages =
      Array.isArray(data.packages) && data.packages.length
        ? data.packages
        : pkgsFromFields;

    // peso reale: se non arriva dal DB ma ci sono packages → somma
    const pesoFromPackages =
      effectivePackages.reduce((sum, p) => sum + (typeof p.weight_kg === "number" ? p.weight_kg : 0), 0) || null;

    const formato =
      pickStr(data.formato_sped, fieldsAny.formato) || null;

    const contenuto =
      pickStr(data.contenuto_generale, fieldsAny.contenuto) || null;

    const giornoRitiro =
      pickStr(
        data.giorno_ritiro,
        fieldsAny.ritiroData, // ISO
        fieldsAny.ritiro_data
      ) || null;

    const noteRitiro =
      pickStr(data.note_ritiro, fieldsAny.ritiroNote, fieldsAny.ritiro_note) || null;

    const destAbilitato =
      pickBool(data.dest_abilitato_import, fieldsAny.destAbilitato) ?? null;

    const declared =
      typeof data.declared_value === "number"
        ? data.declared_value
        : toNum(fieldsAny.insurance_value_eur) ??
          toNum(fieldsAny.valoreAssicurato) ??
          null;

    return {
      ...data,
      // force “riempiti”
      formato_sped: formato,
      contenuto_generale: contenuto,
      giorno_ritiro: giornoRitiro,
      note_ritiro: noteRitiro,
      dest_abilitato_import: destAbilitato,
      declared_value: declared,
      packages: effectivePackages,

      // mittente fallback
      mittente_rs: pickStr(data.mittente_rs, fMitt?.rs) || data.mittente_rs || null,
      mittente_paese: pickStr(data.mittente_paese, fMitt?.paese) || data.mittente_paese || null,
      mittente_citta: pickStr(data.mittente_citta, fMitt?.citta) || data.mittente_citta || null,
      mittente_cap: pickStr(data.mittente_cap, fMitt?.cap) || data.mittente_cap || null,
      mittente_indirizzo: pickStr(data.mittente_indirizzo, fMitt?.indirizzo) || data.mittente_indirizzo || null,
      mittente_telefono: pickStr(data.mittente_telefono, fMitt?.telefono) || data.mittente_telefono || null,
      mittente_piva: pickStr(data.mittente_piva, fMitt?.piva) || data.mittente_piva || null,

      // destinatario fallback
      dest_rs: pickStr(data.dest_rs, fDest?.rs) || data.dest_rs || null,
      dest_paese: pickStr(data.dest_paese, fDest?.paese) || data.dest_paese || null,
      dest_citta: pickStr(data.dest_citta, fDest?.citta) || data.dest_citta || null,
      dest_cap: pickStr(data.dest_cap, fDest?.cap) || data.dest_cap || null,
      dest_indirizzo: pickStr(data.dest_indirizzo, fDest?.indirizzo) || data.dest_indirizzo || null,
      dest_telefono: pickStr(data.dest_telefono, fDest?.telefono) || data.dest_telefono || null,
      dest_piva: pickStr(data.dest_piva, fDest?.piva) || data.dest_piva || null,

      // fatturazione fallback
      fatt_rs: pickStr(data.fatt_rs, fFatt?.rs) || data.fatt_rs || null,
      fatt_paese: pickStr(data.fatt_paese, fFatt?.paese) || data.fatt_paese || null,
      fatt_citta: pickStr(data.fatt_citta, fFatt?.citta) || data.fatt_citta || null,
      fatt_cap: pickStr(data.fatt_cap, fFatt?.cap) || data.fatt_cap || null,
      fatt_indirizzo: pickStr(data.fatt_indirizzo, fFatt?.indirizzo) || data.fatt_indirizzo || null,
      fatt_telefono: pickStr(data.fatt_telefono, fFatt?.telefono) || data.fatt_telefono || null,
      fatt_piva: pickStr(data.fatt_piva, fFatt?.piva) || data.fatt_piva || null,

      // colli_n fallback (se non c’è, conta packages)
      colli_n:
        typeof data.colli_n === "number"
          ? data.colli_n
          : effectivePackages.length
          ? effectivePackages.length
          : null,

      // peso_reale fallback
      peso_reale_kg:
        typeof data.peso_reale_kg === "number"
          ? data.peso_reale_kg
          : typeof pesoFromPackages === "number"
          ? pesoFromPackages
          : null,
    } as ShipmentDetail;
  }, [data]);

  const pkgSummary = useMemo(() => {
    const pkgs = merged?.packages || [];
    if (!pkgs.length) return "—";
    const count = pkgs.length;
    const totalWeight =
      pkgs.reduce(
        (sum, p) => sum + (typeof p.weight_kg === "number" ? p.weight_kg : 0),
        0
      ) || 0;
    return `${count} colli • ${totalWeight.toFixed(2)} kg`;
  }, [merged]);

  async function handleSaveTracking() {
    if (!merged) return;
    setSavingTracking(true);
    setTrackingMsg(null);
    try {
      const res = await fetch(`/api/spedizioni/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          carrier: carrierEdit || null,
          tracking_code: trackingEdit || null,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.ok) throw new Error(json.error || `HTTP ${res.status}`);

      setData((prev) =>
        prev
          ? {
              ...prev,
              carrier: json.carrier ?? carrierEdit,
              tracking_code: json.tracking_code ?? trackingEdit,
            }
          : prev
      );
      setTrackingMsg("Dati corriere salvati.");
    } catch (e) {
      console.error("[BackofficeShipmentDetail] save tracking error:", e);
      setTrackingMsg("Errore nel salvataggio. Riprova.");
    } finally {
      setSavingTracking(false);
      setTimeout(() => setTrackingMsg(null), 3000);
    }
  }

  async function handleSendEmail() {
    if (!merged) return;
    const emailTo = emailConfirm.trim();
    if (!emailTo) return;

    setSendingEmail(true);
    setEmailMsg(null);
    try {
      const res = await fetch(`/api/spedizioni/${id}/evasa`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: emailTo }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.ok) throw new Error(json.error || `HTTP ${res.status}`);

      setEmailMsg("Email inviata correttamente.");
    } catch (e) {
      console.error("[BackofficeShipmentDetail] send email error:", e);
      setEmailMsg("Errore nell'invio email. Controlla configurazione o log.");
    } finally {
      setSendingEmail(false);
      setTimeout(() => setEmailMsg(null), 5000);
    }
  }

  if (loading && !merged && !error) {
    return (
      <div className="flex min-h-[200px] items-center justify-center">
        <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs text-slate-600">
          <Loader2 className="h-4 w-4 animate-spin" />
          Caricamento dettagli spedizione…
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-3">
        <h1 className="text-xl font-semibold text-slate-800">Spedizione {id}</h1>
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      </div>
    );
  }

  if (!merged) {
    return (
      <div className="space-y-3">
        <h1 className="text-xl font-semibold text-slate-800">Spedizione {id}</h1>
        <div className="rounded-2xl border bg-white px-4 py-3 text-sm text-slate-600">
          Nessun dato disponibile per questa spedizione.
        </div>
      </div>
    );
  }

  const humanId = merged.human_id || id;
  const emailCliente = merged.email_cliente || merged.email_norm || "—";
  const emailMatch =
    emailCliente !== "—" &&
    emailConfirm.trim().toLowerCase() === emailCliente.toLowerCase();

  const disableSendButton = !emailMatch || sendingEmail;

  // Packing list: estrazione da fields
  const fieldsAny: any = (merged as any).fields || {};
  const rawPL = fieldsAny.packing_list || fieldsAny.packingList || fieldsAny.pl || null;

  const plRows: any[] = Array.isArray(rawPL?.rows)
    ? rawPL.rows
    : Array.isArray(rawPL)
    ? rawPL
    : [];

  const plNote: string | null = (rawPL && (rawPL.note || rawPL.notes || null)) || null;

  const plTotals = { totalItems: 0, totalQty: 0, totalNetKg: 0, totalGrossKg: 0 };

  plRows.forEach((r: any) => {
    const qtyRaw =
      r.qta ??
      r.quantita ??
      r.qty ??
      r.quantity ??
      r.num ??
      r.numero ??
      r.bottiglie ??
      0;

    const qty = Number(qtyRaw) || 0;

    const netRaw =
      r.net_kg ??
      r.peso_netto ??
      r.netWeight ??
      r.net_weight ??
      (r.peso_netto_bott != null ? qty * Number(r.peso_netto_bott) : 0);

    const net = Number(netRaw) || 0;

    const grossRaw =
      r.gross_kg ??
      r.peso_lordo ??
      r.grossWeight ??
      r.gross_weight ??
      (r.peso_lordo_bott != null ? qty * Number(r.peso_lordo_bott) : 0);

    const gross = Number(grossRaw) || 0;

    plTotals.totalItems += 1;
    plTotals.totalQty += qty;
    plTotals.totalNetKg += net;
    plTotals.totalGrossKg += gross;
  });

  const insuredValue =
    typeof merged.declared_value === "number" ? merged.declared_value : null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
            SPST • Spedizioni clienti
          </div>
          <h1 className="mt-1 text-xl font-semibold text-slate-800">
            Spedizione {humanId}
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            ID interno:{" "}
            <span className="font-mono text-xs text-slate-700">{merged.id}</span>
          </p>
        </div>

        <div className="flex flex-col items-end gap-2 text-xs">
          <div className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-3 py-1 text-white">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-300" />
            <span className="font-medium">{merged.status?.toUpperCase() || "DRAFT"}</span>
          </div>
          <div className="rounded-xl border bg-white px-3 py-2 text-right">
            <div className="text-[11px] text-slate-500">Tipo spedizione</div>
            <div className="text-xs font-medium text-slate-800">
              {merged.tipo_spedizione || "—"} · {merged.incoterm || "—"}
            </div>
            <div className="mt-1 text-[11px] text-slate-500">
              Creato il {formatDateTime(merged.created_at)} • Ritiro {formatDate(merged.giorno_ritiro)}
            </div>
            <div className="mt-1 text-[11px] text-slate-500">
              Cliente: <span className="font-medium text-slate-700">{emailCliente}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Mittente / Destinatario */}
      <div className="grid gap-4 lg:grid-cols-2">
        <section className="space-y-3 rounded-2xl border bg-white p-4">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Mittente
          </div>

          <div className="space-y-1">
            <div className="text-sm font-semibold text-slate-800">{merged.mittente_rs || "—"}</div>
            <div className="text-xs text-slate-600">{merged.mittente_indirizzo || "—"}</div>
          </div>

          <div className="mt-3 space-y-1.5">
            <InfoRow label="CAP" value={merged.mittente_cap || undefined} />
            <InfoRow label="Città" value={merged.mittente_citta || undefined} />
            <InfoRow label="Paese" value={merged.mittente_paese || undefined} />
            <InfoRow label="Telefono" value={merged.mittente_telefono || undefined} />
            <InfoRow label="Partita IVA" value={merged.mittente_piva || undefined} />
          </div>
        </section>

        <section className="space-y-3 rounded-2xl border bg-white p-4">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Destinatario
          </div>

          <div className="space-y-1">
            <div className="text-sm font-semibold text-slate-800">{merged.dest_rs || "—"}</div>
            <div className="text-xs text-slate-600">{merged.dest_indirizzo || "—"}</div>
          </div>

          <div className="mt-3 space-y-1.5">
            <InfoRow label="CAP" value={merged.dest_cap || undefined} />
            <InfoRow label="Città" value={merged.dest_citta || undefined} />
            <InfoRow label="Paese" value={merged.dest_paese || undefined} />
            <InfoRow label="Telefono" value={merged.dest_telefono || undefined} />
            <InfoRow label="Partita IVA / Tax ID" value={merged.dest_piva || undefined} />
            <InfoRow
              label="Abilitato all'import"
              value={
                typeof merged.dest_abilitato_import === "boolean"
                  ? merged.dest_abilitato_import
                    ? "Sì"
                    : "No"
                  : undefined
              }
            />
          </div>
        </section>
      </div>

      {/* Spedizione + Fatturazione */}
      <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
        <section className="space-y-3 rounded-2xl border bg-white p-4">
          <div className="flex items-center justify-between">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Dettagli spedizione
            </div>
            <div className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-700">
              <Package className="h-3 w-3" />
              {pkgSummary}
            </div>
          </div>

          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            <InfoRow
              label="Numero colli"
              value={typeof merged.colli_n === "number" ? String(merged.colli_n) : undefined}
            />
            <InfoRow label="Peso reale" value={formatWeightKg(merged.peso_reale_kg)} />
            <InfoRow label="Formato spedizione" value={merged.formato_sped || undefined} />
            <InfoRow label="Contenuto" value={merged.contenuto_generale || undefined} />

            <InfoRow
              label="Valore assicurato"
              value={
                insuredValue != null
                  ? `${insuredValue.toFixed(2)} ${merged.fatt_valuta || "EUR"}`
                  : "—"
              }
            />

            <InfoRow label="Note ritiro" value={merged.note_ritiro || undefined} />
          </div>
        </section>

        <section className="space-y-3 rounded-2xl border bg-white p-4">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Fatturazione
          </div>

          <div className="space-y-1">
            <div className="text-sm font-semibold text-slate-800">{merged.fatt_rs || "—"}</div>
            <div className="text-xs text-slate-600">{merged.fatt_indirizzo || "—"}</div>
          </div>

          <div className="mt-3 space-y-1.5">
            <InfoRow label="CAP" value={merged.fatt_cap || undefined} />
            <InfoRow label="Città" value={merged.fatt_citta || undefined} />
            <InfoRow label="Paese" value={merged.fatt_paese || undefined} />
            <InfoRow label="Telefono" value={merged.fatt_telefono || undefined} />
            <InfoRow label="P.IVA / Tax ID fattura" value={merged.fatt_piva || undefined} />
            <InfoRow label="Valuta" value={merged.fatt_valuta || undefined} />
          </div>
        </section>
      </div>

      {/* Colli */}
      <section className="space-y-3 rounded-2xl border bg-white p-4">
        <div className="flex items-center justify-between">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Colli
          </div>
        </div>

        <div className="overflow-hidden rounded-xl border border-slate-100">
          <table className="min-w-full border-collapse text-xs">
            <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-3 py-2 text-left">#</th>
                <th className="px-3 py-2 text-left">Dimensioni (cm)</th>
                <th className="px-3 py-2 text-left">Peso (kg)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {!merged.packages || merged.packages.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-3 py-4 text-center text-slate-400">
                    Nessun collo registrato.
                  </td>
                </tr>
              ) : (
                merged.packages.map((p, idx) => (
                  <tr key={p.id || idx} className="hover:bg-slate-50/70">
                    <td className="px-3 py-2 align-middle text-slate-700">{idx + 1}</td>
                    <td className="px-3 py-2 align-middle text-slate-700">
                      {[p.l1, p.l2, p.l3]
                        .map((v) => (typeof v === "number" ? `${v.toFixed(0)}` : "—"))
                        .join(" × ")}
                    </td>
                    <td className="px-3 py-2 align-middle text-slate-700">
                      {typeof p.weight_kg === "number" ? `${p.weight_kg.toFixed(2)}` : "—"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Packing list */}
      <section className="space-y-3 rounded-2xl border bg-white p-4">
        <div className="flex items-center justify-between gap-2">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Packing list
          </div>
          {plRows.length > 0 && (
            <div className="text-[11px] text-slate-500">
              {plTotals.totalItems} righe • Q.tà tot: {plTotals.totalQty || "—"} • Netto:{" "}
              {plTotals.totalNetKg.toFixed(2)} kg • Lordo: {plTotals.totalGrossKg.toFixed(2)} kg
            </div>
          )}
        </div>

        {plRows.length === 0 ? (
          <>
            <p className="text-[11px] text-slate-500">
              Nessuna packing list strutturata trovata nei dati della spedizione.
            </p>
            {fieldsAny && (
              <details className="mt-2 rounded-lg border border-dashed border-slate-200 bg-slate-50 px-3 py-2 text-[11px] text-slate-500">
                <summary className="cursor-pointer font-medium">Debug dati raw (fields)</summary>
                <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap text-[10px]">
                  {JSON.stringify(fieldsAny, null, 2)}
                </pre>
              </details>
            )}
          </>
        ) : (
          <>
            <div className="overflow-hidden rounded-xl border border-slate-100">
              <table className="min-w-full border-collapse text-xs">
                <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-3 py-2 text-left">#</th>
                    <th className="px-3 py-2 text-left">Etichetta</th>
                    <th className="px-3 py-2 text-left">Tipologia</th>
                    <th className="px-3 py-2 text-left">Q.tà</th>
                    <th className="px-3 py-2 text-left">Formato (L)</th>
                    <th className="px-3 py-2 text-left">Gradazione</th>
                    <th className="px-3 py-2 text-left">Prezzo</th>
                    <th className="px-3 py-2 text-left">Valuta</th>
                    <th className="px-3 py-2 text-left">Peso netto (kg)</th>
                    <th className="px-3 py-2 text-left">Peso lordo (kg)</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {plRows.map((r: any, idx: number) => {
                    const qty = toNum(
                      r.bottiglie ??
                        r.qta ??
                        r.quantita ??
                        r.qty ??
                        r.quantity ??
                        r.num ??
                        r.numero ??
                        null
                    );

                    const formato = toNum(r.formato_litri);
                    const grad = toNum(r.gradazione);
                    const prezzo = toNum(r.prezzo);
                    const valuta = r.valuta || "EUR";

                    const pesoNetto = toNum(
                      r.peso_netto_bott ??
                        r.peso_netto ??
                        r.net_kg ??
                        r.netWeight ??
                        r.net_weight
                    );

                    const pesoLordo = toNum(
                      r.peso_lordo_bott ??
                        r.peso_lordo ??
                        r.gross_kg ??
                        r.grossWeight ??
                        r.gross_weight
                    );

                    return (
                      <tr key={r.id || idx} className="hover:bg-slate-50/70">
                        <td className="px-3 py-2 align-middle text-slate-700">{idx + 1}</td>
                        <td className="px-3 py-2 align-middle text-slate-700">
                          {r.etichetta ||
                            r.description ||
                            r.descrizione ||
                            r.nome ||
                            r.label ||
                            r.prodotto ||
                            `Riga ${idx + 1}`}
                        </td>
                        <td className="px-3 py-2 align-middle text-slate-700 capitalize">
                          {r.tipologia || "—"}
                        </td>
                        <td className="px-3 py-2 align-middle text-slate-700">{qty ?? "—"}</td>
                        <td className="px-3 py-2 align-middle text-slate-700">
                          {formato != null ? formato.toFixed(2) : "—"}
                        </td>
                        <td className="px-3 py-2 align-middle text-slate-700">
                          {grad != null ? `${grad}%` : "—"}
                        </td>
                        <td className="px-3 py-2 align-middle text-slate-700">
                          {prezzo != null ? prezzo.toFixed(2) : "—"}
                        </td>
                        <td className="px-3 py-2 align-middle text-slate-700">{valuta}</td>
                        <td className="px-3 py-2 align-middle text-slate-700">
                          {pesoNetto != null ? pesoNetto.toFixed(2) : "—"}
                        </td>
                        <td className="px-3 py-2 align-middle text-slate-700">
                          {pesoLordo != null ? pesoLordo.toFixed(2) : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>

                <tfoot className="bg-slate-50 text-[11px] text-slate-600">
                  <tr>
                    <td className="px-3 py-2 font-semibold" colSpan={3}>
                      Totali
                    </td>
                    <td className="px-3 py-2 font-semibold">{plTotals.totalQty || "—"}</td>
                    <td className="px-3 py-2" />
                    <td className="px-3 py-2" />
                    <td className="px-3 py-2" />
                    <td className="px-3 py-2" />
                    <td className="px-3 py-2 font-semibold">
                      {plTotals.totalNetKg.toFixed(2)} kg
                    </td>
                    <td className="px-3 py-2 font-semibold">
                      {plTotals.totalGrossKg.toFixed(2)} kg
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {plNote && <p className="mt-2 text-[11px] text-slate-500">Note: {plNote}</p>}
          </>
        )}
      </section>

      {/* Documenti */}
      <section className="space-y-3 rounded-2xl border bg-white p-4">
        <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Documenti spedizione
        </div>
        <p className="text-[11px] text-slate-500">
          Qui potrai allegare LDV, fatture, packing list, DLE e allegati 1–4.
          I pulsanti "Carica" permettono ora l’upload diretto nel bucket.
        </p>

        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <AttachmentRow
            label="Lettera di vettura (LDV)"
            att={merged.attachments?.ldv}
            type="ldv"
            shipmentId={merged.id}
            onUploaded={() => window.location.reload()}
          />

          <AttachmentRow
            label="Fattura commerciale"
            att={merged.attachments?.fattura_commerciale}
            type="fattura_commerciale"
            shipmentId={merged.id}
            onUploaded={() => window.location.reload()}
          />

          <AttachmentRow
            label="Fattura proforma"
            att={merged.attachments?.fattura_proforma}
            type="fattura_proforma"
            shipmentId={merged.id}
            onUploaded={() => window.location.reload()}
          />

          <AttachmentRow
            label="Documento DLE"
            att={merged.attachments?.dle}
            type="dle"
            shipmentId={merged.id}
            onUploaded={() => window.location.reload()}
          />

          <AttachmentRow
            label="Allegato 1"
            att={merged.attachments?.allegato1}
            type="allegato1"
            shipmentId={merged.id}
            onUploaded={() => window.location.reload()}
          />

          <AttachmentRow
            label="Allegato 2"
            att={merged.attachments?.allegato2}
            type="allegato2"
            shipmentId={merged.id}
            onUploaded={() => window.location.reload()}
          />

          <AttachmentRow
            label="Allegato 3"
            att={merged.attachments?.allegato3}
            type="allegato3"
            shipmentId={merged.id}
            onUploaded={() => window.location.reload()}
          />

          <AttachmentRow
            label="Allegato 4"
            att={merged.attachments?.allegato4}
            type="allegato4"
            shipmentId={merged.id}
            onUploaded={() => window.location.reload()}
          />
        </div>
      </section>

      {/* Corriere / tracking + azioni */}
      <section className="space-y-4 rounded-2xl border bg-white p-4">
        <div className="grid gap-4 md:grid-cols-[2fr_1fr]">
          <div className="space-y-3">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Corriere & tracking
            </div>

            <div className="space-y-2 text-xs">
              <div className="space-y-1">
                <label className="text-[11px] font-medium text-slate-600">Corriere</label>
                <select
                  className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-800 focus:border-slate-400 focus:outline-none"
                  value={carrierEdit}
                  onChange={(e) => setCarrierEdit(e.target.value)}
                >
                  <option value="">Seleziona corriere</option>
                  <option value="TNT">TNT</option>
                  <option value="Poste">Poste</option>
                  <option value="FedEx">FedEx</option>
                  <option value="UPS">UPS</option>
                  <option value="DHL">DHL</option>
                  <option value="Privato">Privato</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-medium text-slate-600">Numero di tracking</label>
                <input
                  type="text"
                  className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-800 focus:border-slate-400 focus:outline-none"
                  value={trackingEdit}
                  onChange={(e) => setTrackingEdit(e.target.value)}
                  placeholder="Inserisci il codice tracking"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleSaveTracking}
                  disabled={savingTracking}
                  className="inline-flex items-center justify-center gap-1 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-60"
                >
                  {savingTracking && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  Salva
                </button>
                {trackingMsg && <span className="text-[11px] text-slate-500">{trackingMsg}</span>}
              </div>

              <p className="text-[11px] text-slate-500">
                Questi dati vengono salvati sulla spedizione e saranno usati successivamente per il
                tracking automatico.
              </p>
            </div>
          </div>

          <div className="space-y-3 text-xs">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Azioni
            </div>

            <div className="space-y-1">
              <div className="text-[11px] text-slate-500">Email cliente salvata</div>
              <div className="rounded-lg border border-slate-100 bg-slate-50 px-2 py-1.5 text-[11px] text-slate-700">
                {emailCliente}
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-medium text-slate-600">
                Riscrivi l&apos;email del cliente
              </label>
              <input
                type="email"
                className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-800 focus:border-slate-400 focus:outline-none"
                value={emailConfirm}
                onChange={(e) => setEmailConfirm(e.target.value)}
                placeholder="Digita di nuovo l'email per conferma"
              />
              <p className="text-[11px] text-slate-500">
                Per ragioni di sicurezza, l&apos;invio email è attivo solo se l&apos;indirizzo
                inserito coincide con quello salvato.
              </p>
            </div>

            <button
              type="button"
              onClick={disableSendButton ? undefined : handleSendEmail}
              disabled={disableSendButton}
              className={`inline-flex w-full items-center justify-center gap-1 rounded-lg border px-3 py-2 text-xs ${
                disableSendButton
                  ? "border-slate-200 bg-white text-slate-400"
                  : "border-slate-900 bg-slate-900 text-white"
              }`}
            >
              {sendingEmail && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              <Mail className="h-3.5 w-3.5" />
              Invia mail &quot;Spedizione evasa&quot;
            </button>
            {emailMsg && <p className="text-[11px] text-slate-500">{emailMsg}</p>}

            <button
              type="button"
              disabled
              className="inline-flex w-full items-center justify-center gap-1 rounded-lg bg-slate-900 px-3 py-2 text-xs text-white opacity-70"
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              Evasione completata
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
