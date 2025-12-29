"use client";

import { useMemo, useState } from "react";
import { Loader2 } from "lucide-react";

import type { ShipmentDetailFlat } from "@/lib/backoffice/normalizeShipmentDetail";
import { useBackofficeShipmentDetail } from "@/components/backoffice/_parts/useBackofficeShipmentDetail";
import { mergeShipmentDetail } from "@/components/backoffice/_parts/mergeShipmentDetail";

import { HeaderSection } from "@/components/backoffice/_parts/sections/HeaderSection";
import { PartiesSection } from "@/components/backoffice/_parts/sections/PartiesSection";
import { ShipmentAndBillingSection } from "@/components/backoffice/_parts/sections/ShipmentAndBillingSection";
import { PackagesSection } from "@/components/backoffice/_parts/sections/PackagesSection";
import { PackingListSection } from "@/components/backoffice/_parts/sections/PackingListSection";
import { DocumentsSection } from "@/components/backoffice/_parts/sections/DocumentsSection";
import { ActionsSection } from "@/components/backoffice/_parts/sections/ActionsSection";

type Props = { id: string };
type ShipmentDetail = ShipmentDetailFlat;

export default function BackofficeShipmentDetailClient({ id }: Props) {
  const { data, loading, error, reload } = useBackofficeShipmentDetail(id);

  const [carrierEdit, setCarrierEdit] = useState("");
  const [trackingEdit, setTrackingEdit] = useState("");
  const [savingTracking, setSavingTracking] = useState(false);
  const [trackingMsg, setTrackingMsg] = useState<string | null>(null);

  const [emailConfirm, setEmailConfirm] = useState("");
  const [sendingEmail, setSendingEmail] = useState(false);
  const [emailMsg, setEmailMsg] = useState<string | null>(null);

  // ✅ stato per “IN RITIRO”
  const [markingInRitiro, setMarkingInRitiro] = useState(false);
  const [markMsg, setMarkMsg] = useState<string | null>(null);

  const merged = useMemo(() => {
    if (!data) return null;
    return mergeShipmentDetail(data as ShipmentDetail);
  }, [data]);

  useMemo(() => {
    if (!merged) return;
    setCarrierEdit((prev) => (prev ? prev : merged.carrier || ""));
    setTrackingEdit((prev) => (prev ? prev : merged.tracking_code || ""));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [merged?.id]);

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
      setTrackingMsg("Dati corriere salvati.");
      reload();
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

  // ✅ “Evasione completata” -> set status = IN RITIRO (email non c’entra)
  async function handleMarkInRitiro() {
    if (!merged) return;
    setMarkingInRitiro(true);
    setMarkMsg(null);
    try {
      const res = await fetch(`/api/spedizioni/${id}/evasa`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "MARK_IN_RITIRO" }), // payload ignorabile lato server
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.ok) throw new Error(json.error || `HTTP ${res.status}`);

      setMarkMsg(`Status aggiornato: ${json.status || "IN RITIRO"}`);
      reload();
    } catch (e: any) {
      console.error("[BackofficeShipmentDetail] mark IN RITIRO error:", e);
      setMarkMsg("Errore: impossibile aggiornare lo status.");
    } finally {
      setMarkingInRitiro(false);
      setTimeout(() => setMarkMsg(null), 4000);
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

  return (
    <div className="space-y-6">
      <HeaderSection shipment={merged} />
      <PartiesSection shipment={merged} />
      <ShipmentAndBillingSection shipment={merged} pkgSummary={pkgSummary} />
      <PackagesSection shipment={merged} />
      <PackingListSection shipment={merged} />
      <DocumentsSection shipment={merged} onUploaded={reload} />
      <ActionsSection
        shipment={merged}
        carrierEdit={carrierEdit}
        setCarrierEdit={setCarrierEdit}
        trackingEdit={trackingEdit}
        setTrackingEdit={setTrackingEdit}
        savingTracking={savingTracking}
        trackingMsg={trackingMsg}
        onSaveTracking={handleSaveTracking}
        emailConfirm={emailConfirm}
        setEmailConfirm={setEmailConfirm}
        sendingEmail={sendingEmail}
        emailMsg={emailMsg}
        onSendEmail={handleSendEmail}
        markingInRitiro={markingInRitiro}
        markMsg={markMsg}
        onMarkInRitiro={handleMarkInRitiro}
      />
    </div>
  );
}
