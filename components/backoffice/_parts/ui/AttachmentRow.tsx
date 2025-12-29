"use client";

import Link from "next/link";
import { FileText } from "lucide-react";
import type { AttachmentInfo } from "@/lib/backoffice/normalizeShipmentDetail";

export function AttachmentRow({
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

    const json = await res.json().catch(() => ({}));

    if (json.ok) onUploaded(json.url);
    else alert("Errore upload: " + (json.error || "unknown"));
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
