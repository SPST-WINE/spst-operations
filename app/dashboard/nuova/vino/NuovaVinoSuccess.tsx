// FILE: app/dashboard/nuova/vino/NuovaVinoSuccess.tsx
"use client";

import type { SuccessInfo } from "./_logic/types";
import { INFO_URL_DEFAULT, WHATSAPP_URL_DEFAULT } from "./_logic/constants";

type Props = {
  success: SuccessInfo;
  onGoToSpedizioni: () => void;
};

export default function NuovaVinoSuccess({ success, onGoToSpedizioni }: Props) {
  const INFO_URL = process.env.NEXT_PUBLIC_INFO_URL || INFO_URL_DEFAULT;
  const WHATSAPP_URL_BASE = process.env.NEXT_PUBLIC_WHATSAPP_URL || WHATSAPP_URL_DEFAULT;

  const whatsappHref = `${WHATSAPP_URL_BASE}?text=${encodeURIComponent(
    `Ciao SPST, ho bisogno di supporto sulla spedizione ${success.idSped}`
  )}`;

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Spedizione creata</h2>

      <div className="rounded-2xl border bg-white p-4">
        <div className="mb-3 text-sm">
          <div className="font-medium">ID Spedizione</div>
          <div className="font-mono">{success.idSped}</div>
        </div>

        <div className="grid gap-3 md:grid-cols-2 text-sm">
          <div>
            <span className="text-slate-500">Tipo:</span> {success.tipoSped}
          </div>
          <div>
            <span className="text-slate-500">Incoterm:</span> {success.incoterm}
          </div>
          <div>
            <span className="text-slate-500">Data ritiro:</span> {success.dataRitiro ?? "—"}
          </div>
          <div>
            <span className="text-slate-500">Colli:</span> {success.colli} ({success.formato})
          </div>
          <div className="md:col-span-2">
            <span className="text-slate-500">Destinatario:</span>{" "}
            {success.destinatario.ragioneSociale || "—"}
            {success.destinatario.citta ? ` — ${success.destinatario.citta}` : ""}
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onGoToSpedizioni}
            className="rounded-lg border bg-white px-4 py-2 text-sm hover:bg-slate-50"
          >
            Le mie spedizioni
          </button>

          <a
            href={INFO_URL}
            className="rounded-lg border bg-white px-4 py-2 text-sm hover:bg-slate-50"
          >
            Documenti & info utili
          </a>

          <a
            href={whatsappHref}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-lg border px-4 py-2 text-sm hover:bg-slate-50"
            style={{ borderColor: "#f7911e" }}
          >
            Supporto WhatsApp
          </a>

          <span className="text-sm text-green-700">Email di conferma inviata ✅</span>
        </div>

        <div className="mt-6 text-xs text-slate-500">
          Suggerimento: conserva l’ID per future comunicazioni. Puoi chiudere questa pagina.
        </div>
      </div>
    </div>
  );
}
