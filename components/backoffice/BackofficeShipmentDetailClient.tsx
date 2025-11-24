// components/backoffice/BackofficeShipmentDetailClient.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Loader2, Mail, CheckCircle2, FileText, Package } from "lucide-react";

type AttachmentInfo =
  | {
      url: string;
      file_name?: string | null;
      mime_type?: string | null;
      size?: number | null;
    }
  | null;

type PackageRow = {
  id?: string;
  l1?: number | null;
  l2?: number | null;
  l3?: number | null;
  weight_kg?: number | null;
};

type ShipmentDetail = {
  id: string;
  created_at?: string;
  human_id?: string | null;
  email_cliente?: string | null;
  email_norm?: string | null;

  status?: string | null;
  carrier?: string | null;
  tracking_code?: string | null;

  tipo_spedizione?: string | null;
  incoterm?: string | null;
  giorno_ritiro?: string | null;
  note_ritiro?: string | null;

  mittente_rs?: string | null;
  mittente_paese?: string | null;
  mittente_citta?: string | null;
  mittente_cap?: string | null;
  mittente_indirizzo?: string | null;
  mittente_telefono?: string | null;
  mittente_piva?: string | null;

  dest_rs?: string | null;
  dest_paese?: string | null;
  dest_citta?: string | null;
  dest_cap?: string | null;
  dest_indirizzo?: string | null;
  dest_telefono?: string | null;
  dest_piva?: string | null;

  fatt_rs?: string | null;
  fatt_paese?: string | null;
  fatt_citta?: string | null;
  fatt_cap?: string | null;
  fatt_indirizzo?: string | null;
  fatt_telefono?: string | null;
  fatt_piva?: string | null;
  fatt_valuta?: string | null;

  colli_n?: number | null;
  peso_reale_kg?: number | null;
  formato_sped?: string | null;
  contenuto_generale?: string | null;
  dest_abilitato_import?: boolean | null;

  attachments?: {
    ldv?: AttachmentInfo;
    fattura_proforma?: AttachmentInfo;
    fattura_commerciale?: AttachmentInfo;
    dle?: AttachmentInfo;
    allegato1?: AttachmentInfo;
    allegato2?: AttachmentInfo;
    allegato3?: AttachmentInfo;
    allegato4?: AttachmentInfo;
  };

  packages?: PackageRow[];
};

type Props = {
  id: string;
};

function formatDateTime(s?: string | null) {
  if (!s) return "—";
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("it-IT", {
    dateStyle: "short",
    timeStyle: "short",
  });
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
          <input
            type="file"
            className="hidden"
            onChange={handleUpload}
          />
        </label>
      </div>
    </div>
  );
}


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
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }
        const json = await res.json();
        if (!active) return;

        if (json?.ok && json.shipment) {
          const s = json.shipment as ShipmentDetail;
          setData(s);
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

  const pkgSummary = useMemo(() => {
    const pkgs = data?.packages || [];
    if (!pkgs.length) return "—";
    const count = pkgs.length;
    const totalWeight =
      pkgs.reduce(
        (sum, p) =>
          sum + (typeof p.weight_kg === "number" ? p.weight_kg : 0),
        0
      ) || 0;
    return `${count} colli • ${totalWeight.toFixed(2)} kg`;
  }, [data]);

  async function handleSaveTracking() {
    if (!data) return;
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
      if (!res.ok || !json.ok) {
        throw new Error(json.error || `HTTP ${res.status}`);
      }
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
    if (!data) return;
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

      if (!res.ok || !json.ok) {
        throw new Error(json.error || `HTTP ${res.status}`);
      }

      setEmailMsg("Email inviata correttamente.");
    } catch (e) {
      console.error("[BackofficeShipmentDetail] send email error:", e);
      setEmailMsg("Errore nell'invio email. Controlla configurazione o log.");
    } finally {
      setSendingEmail(false);
      setTimeout(() => setEmailMsg(null), 5000);
    }
  }

  if (loading && !data && !error) {
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
        <h1 className="text-xl font-semibold text-slate-800">
          Spedizione {id}
        </h1>
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="space-y-3">
        <h1 className="text-xl font-semibold text-slate-800">
          Spedizione {id}
        </h1>
        <div className="rounded-2xl border bg-white px-4 py-3 text-sm text-slate-600">
          Nessun dato disponibile per questa spedizione.
        </div>
      </div>
    );
  }

  const humanId = data.human_id || id;
  const emailCliente = data.email_cliente || data.email_norm || "—";
  const emailMatch =
    emailCliente !== "—" &&
    emailConfirm.trim().toLowerCase() === emailCliente.toLowerCase();

  const disableSendButton = !emailMatch || sendingEmail;

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
            <span className="font-mono text-xs text-slate-700">{data.id}</span>
          </p>
        </div>

        <div className="flex flex-col items-end gap-2 text-xs">
          <div className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-3 py-1 text-white">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-300" />
            <span className="font-medium">
              {data.status?.toUpperCase() || "DRAFT"}
            </span>
          </div>
          <div className="rounded-xl border bg-white px-3 py-2 text-right">
            <div className="text-[11px] text-slate-500">Tipo spedizione</div>
            <div className="text-xs font-medium text-slate-800">
              {data.tipo_spedizione || "—"} · {data.incoterm || "—"}
            </div>
            <div className="mt-1 text-[11px] text-slate-500">
              Creato il {formatDateTime(data.created_at)} • Ritiro{" "}
              {formatDate(data.giorno_ritiro)}
            </div>
            <div className="mt-1 text-[11px] text-slate-500">
              Cliente:{" "}
              <span className="font-medium text-slate-700">
                {emailCliente}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Mittente / Destinatario */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Mittente */}
        <section className="space-y-3 rounded-2xl border bg-white p-4">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Mittente
          </div>

          <div className="space-y-1">
            <div className="text-sm font-semibold text-slate-800">
              {data.mittente_rs || "—"}
            </div>
            <div className="text-xs text-slate-600">
              {data.mittente_indirizzo || "—"}
            </div>
          </div>

          <div className="mt-3 space-y-1.5">
            <InfoRow label="CAP" value={data.mittente_cap || undefined} />
            <InfoRow label="Città" value={data.mittente_citta || undefined} />
            <InfoRow label="Paese" value={data.mittente_paese || undefined} />
            <InfoRow
              label="Telefono"
              value={data.mittente_telefono || undefined}
            />
            <InfoRow
              label="Partita IVA"
              value={data.mittente_piva || undefined}
            />
          </div>
        </section>

        {/* Destinatario */}
        <section className="space-y-3 rounded-2xl border bg-white p-4">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Destinatario
          </div>

          <div className="space-y-1">
            <div className="text-sm font-semibold text-slate-800">
              {data.dest_rs || "—"}
            </div>
            <div className="text-xs text-slate-600">
              {data.dest_indirizzo || "—"}
            </div>
          </div>

          <div className="mt-3 space-y-1.5">
            <InfoRow label="CAP" value={data.dest_cap || undefined} />
            <InfoRow label="Città" value={data.dest_citta || undefined} />
            <InfoRow label="Paese" value={data.dest_paese || undefined} />
            <InfoRow
              label="Telefono"
              value={data.dest_telefono || undefined}
            />
            <InfoRow
              label="Partita IVA / Tax ID"
              value={data.dest_piva || undefined}
            />
            <InfoRow
              label="Abilitato all'import"
              value={
                typeof data.dest_abilitato_import === "boolean"
                  ? data.dest_abilitato_import
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
              value={
                typeof data.colli_n === "number"
                  ? String(data.colli_n)
                  : undefined
              }
            />
            <InfoRow
              label="Peso reale"
              value={formatWeightKg(data.peso_reale_kg)}
            />
            <InfoRow
              label="Formato spedizione"
              value={data.formato_sped || undefined}
            />
            <InfoRow
              label="Contenuto"
              value={data.contenuto_generale || undefined}
            />
            <InfoRow
              label="Note ritiro"
              value={data.note_ritiro || undefined}
            />
          </div>
        </section>

        <section className="space-y-3 rounded-2xl border bg-white p-4">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Fatturazione
          </div>

          <div className="space-y-1">
            <div className="text-sm font-semibold text-slate-800">
              {data.fatt_rs || "—"}
            </div>
            <div className="text-xs text-slate-600">
              {data.fatt_indirizzo || "—"}
            </div>
          </div>

          <div className="mt-3 space-y-1.5">
            <InfoRow label="CAP" value={data.fatt_cap || undefined} />
            <InfoRow label="Città" value={data.fatt_citta || undefined} />
            <InfoRow label="Paese" value={data.fatt_paese || undefined} />
            <InfoRow
              label="Telefono"
              value={data.fatt_telefono || undefined}
            />
            <InfoRow
              label="P.IVA / Tax ID fattura"
              value={data.fatt_piva || undefined}
            />
            <InfoRow label="Valuta" value={data.fatt_valuta || undefined} />
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
              {!data.packages || data.packages.length === 0 ? (
                <tr>
                  <td
                    colSpan={3}
                    className="px-3 py-4 text-center text-slate-400"
                  >
                    Nessun collo registrato.
                  </td>
                </tr>
              ) : (
                data.packages.map((p, idx) => (
                  <tr key={p.id || idx} className="hover:bg-slate-50/70">
                    <td className="px-3 py-2 align-middle text-slate-700">
                      {idx + 1}
                    </td>
                    <td className="px-3 py-2 align-middle text-slate-700">
                      {[p.l1, p.l2, p.l3]
                        .map((v) =>
                          typeof v === "number" ? `${v.toFixed(0)}` : "—"
                        )
                        .join(" × ")}
                    </td>
                    <td className="px-3 py-2 align-middle text-slate-700">
                      {typeof p.weight_kg === "number"
                        ? `${p.weight_kg.toFixed(2)}`
                        : "—"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
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
      att={data.attachments?.ldv}
      type="ldv"
      shipmentId={data.id}
      onUploaded={() => window.location.reload()}
    />

    <AttachmentRow
      label="Fattura commerciale"
      att={data.attachments?.fattura_commerciale}
      type="fattura_commerciale"
      shipmentId={data.id}
      onUploaded={() => window.location.reload()}
    />

    <AttachmentRow
      label="Fattura proforma"
      att={data.attachments?.fattura_proforma}
      type="fattura_proforma"
      shipmentId={data.id}
      onUploaded={() => window.location.reload()}
    />

    <AttachmentRow
      label="Documento DLE"
      att={data.attachments?.dle}
      type="dle"
      shipmentId={data.id}
      onUploaded={() => window.location.reload()}
    />

    <AttachmentRow
      label="Allegato 1"
      att={data.attachments?.allegato1}
      type="allegato1"
      shipmentId={data.id}
      onUploaded={() => window.location.reload()}
    />

    <AttachmentRow
      label="Allegato 2"
      att={data.attachments?.allegato2}
      type="allegato2"
      shipmentId={data.id}
      onUploaded={() => window.location.reload()}
    />

    <AttachmentRow
      label="Allegato 3"
      att={data.attachments?.allegato3}
      type="allegato3"
      shipmentId={data.id}
      onUploaded={() => window.location.reload()}
    />

    <AttachmentRow
      label="Allegato 4"
      att={data.attachments?.allegato4}
      type="allegato4"
      shipmentId={data.id}
      onUploaded={() => window.location.reload()}
    />

  </div>
</section>

      {/* Corriere / tracking + azioni */}
      <section className="space-y-4 rounded-2xl border bg-white p-4">
        <div className="grid gap-4 md:grid-cols-[2fr_1fr]">
          {/* Card corriere & tracking */}
          <div className="space-y-3">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Corriere & tracking
            </div>

            <div className="space-y-2 text-xs">
              <div className="space-y-1">
                <label className="text-[11px] font-medium text-slate-600">
                  Corriere
                </label>
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
                <label className="text-[11px] font-medium text-slate-600">
                  Numero di tracking
                </label>
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
                  {savingTracking && (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  )}
                  Salva
                </button>
                {trackingMsg && (
                  <span className="text-[11px] text-slate-500">
                    {trackingMsg}
                  </span>
                )}
              </div>

              <p className="text-[11px] text-slate-500">
                Questi dati vengono salvati sulla spedizione e saranno usati
                successivamente per il tracking automatico.
              </p>
            </div>
          </div>

          {/* Card azioni */}
          <div className="space-y-3 text-xs">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Azioni
            </div>

            <div className="space-y-1">
              <div className="text-[11px] text-slate-500">
                Email cliente salvata
              </div>
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
                Per ragioni di sicurezza, l&apos;invio email è attivo solo se
                l&apos;indirizzo inserito coincide con quello salvato.
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
              {sendingEmail && (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              )}
              <Mail className="h-3.5 w-3.5" />
              Invia mail &quot;Spedizione evasa&quot;
            </button>
            {emailMsg && (
              <p className="text-[11px] text-slate-500">{emailMsg}</p>
            )}

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
