"use client";

import { CheckCircle2, Loader2, Mail } from "lucide-react";
import type { ShipmentDetailFlat } from "@/lib/backoffice/normalizeShipmentDetail";

export function ActionsSection({
  shipment,

  carrierEdit,
  setCarrierEdit,
  trackingEdit,
  setTrackingEdit,
  savingTracking,
  trackingMsg,
  onSaveTracking,

  emailConfirm,
  setEmailConfirm,
  sendingEmail,
  emailMsg,
  onSendEmail,
}: {
  shipment: ShipmentDetailFlat;

  carrierEdit: string;
  setCarrierEdit: (v: string) => void;
  trackingEdit: string;
  setTrackingEdit: (v: string) => void;
  savingTracking: boolean;
  trackingMsg: string | null;
  onSaveTracking: () => Promise<void>;

  emailConfirm: string;
  setEmailConfirm: (v: string) => void;
  sendingEmail: boolean;
  emailMsg: string | null;
  onSendEmail: () => Promise<void>;
}) {
  const emailCliente = shipment.email_cliente || shipment.email_norm || "—";
  const emailMatch =
    emailCliente !== "—" && emailConfirm.trim().toLowerCase() === emailCliente.toLowerCase();
  const disableSendButton = !emailMatch || sendingEmail;

  return (
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
                onClick={onSaveTracking}
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
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Azioni</div>

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
            onClick={disableSendButton ? undefined : onSendEmail}
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
  );
}
