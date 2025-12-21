// components/backoffice/quotazioni/StatusBadge.tsx
"use client";

export default function StatusBadge({ value }: { value?: string | null }) {
  const v = (value || "").toLowerCase();
  let cls = "bg-slate-50 text-slate-700 ring-slate-200";
  const label = value || "—";

  if (v.includes("nuova")) {
    cls = "bg-sky-50 text-sky-700 ring-sky-200";
  } else if (v.includes("lavoraz")) {
    cls = "bg-amber-50 text-amber-700 ring-amber-200";
  } else if (v.includes("inviata")) {
    cls = "bg-indigo-50 text-indigo-700 ring-indigo-200";
  } else if (v.includes("accettata")) {
    cls = "bg-emerald-50 text-emerald-700 ring-emerald-200";
  } else if (v.includes("rifiutata") || v.includes("scaduta")) {
    cls = "bg-rose-50 text-rose-700 ring-rose-200";
  }

  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs ring-1 ${cls}`}>
      {label}
    </span>
  );
}
