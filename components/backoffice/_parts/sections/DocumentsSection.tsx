"use client";

import type { ShipmentDetailFlat } from "@/lib/backoffice/normalizeShipmentDetail";
import { AttachmentRow } from "@/components/backoffice/_parts/ui/AttachmentRow";

export function DocumentsSection({
  shipment,
  onUploaded,
}: {
  shipment: ShipmentDetailFlat;
  onUploaded: () => void;
}) {
  return (
    <section className="space-y-3 rounded-2xl border bg-white p-4">
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        Documenti spedizione
      </div>
      <p className="text-[11px] text-slate-500">
        Qui potrai allegare LDV, fatture, packing list, DLE e allegati 1–4.
        I pulsanti "Carica" permettono ora l’upload diretto nel bucket.
      </p>

      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <AttachmentRow label="Lettera di vettura (LDV)" att={shipment.attachments?.ldv} type="ldv" shipmentId={shipment.id} onUploaded={() => onUploaded()} />
        <AttachmentRow label="Fattura commerciale" att={shipment.attachments?.fattura_commerciale} type="fattura_commerciale" shipmentId={shipment.id} onUploaded={() => onUploaded()} />
        <AttachmentRow label="Fattura proforma" att={shipment.attachments?.fattura_proforma} type="fattura_proforma" shipmentId={shipment.id} onUploaded={() => onUploaded()} />
        <AttachmentRow label="Documento DLE" att={shipment.attachments?.dle} type="dle" shipmentId={shipment.id} onUploaded={() => onUploaded()} />
        <AttachmentRow label="Allegato 1" att={shipment.attachments?.allegato1} type="allegato1" shipmentId={shipment.id} onUploaded={() => onUploaded()} />
        <AttachmentRow label="Allegato 2" att={shipment.attachments?.allegato2} type="allegato2" shipmentId={shipment.id} onUploaded={() => onUploaded()} />
        <AttachmentRow label="Allegato 3" att={shipment.attachments?.allegato3} type="allegato3" shipmentId={shipment.id} onUploaded={() => onUploaded()} />
        <AttachmentRow label="Allegato 4" att={shipment.attachments?.allegato4} type="allegato4" shipmentId={shipment.id} onUploaded={() => onUploaded()} />
      </div>
    </section>
  );
}
