// components/backoffice/quote-detail/ui.tsx
"use client";

import React from "react";

export function StatusBadge({ value }: { value?: string | null }) {
  const v = (value || "").toLowerCase();
  let cls = "bg-slate-50 text-slate-700 ring-slate-200";
  let label = value || "—";

  if (v.includes("nuova")) {
    cls = "bg-sky-50 text-sky-700 ring-sky-200";
  } else if (v.includes("lavoraz")) {
    cls = "bg-amber-50 text-amber-700 ring-amber-200";
  } else if (v.includes("inviat")) {
    cls = "bg-indigo-50 text-indigo-700 ring-indigo-200";
  } else if (v.includes("accett")) {
    cls = "bg-emerald-50 text-emerald-700 ring-emerald-200";
  } else if (v.includes("rifiut") || v.includes("scad")) {
    cls = "bg-rose-50 text-rose-700 ring-rose-200";
  }

  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs ring-1 ${cls}`}
    >
      {label}
    </span>
  );
}

export function InfoRow({
  label,
  value,
}: {
  label: string;
  value?: string | null;
}) {
  return (
    <div className="flex justify-between gap-4 text-xs">
      <span className="text-slate-500">{label}</span>
      <span className="max-w-[60%] text-right text-slate-800">
        {value && value.trim() !== "" ? value : "—"}
      </span>
    </div>
  );
}
