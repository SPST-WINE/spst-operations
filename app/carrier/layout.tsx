// app/carrier/layout.tsx
import Link from "next/link";

export const dynamic = "force-dynamic";

export default function CarrierLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-slate-50">
      <header className="sticky top-0 z-10 border-b bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-900 text-white text-xs font-semibold">
              SPST
            </div>
            <div>
              <div className="text-sm font-semibold text-slate-900">
                Portale Trasportatore
              </div>
              <div className="text-xs text-slate-500">
                Waves • Ritiri • DDT
              </div>
            </div>
          </div>

          <nav className="flex items-center gap-3 text-sm">
            <Link
              href="/carrier/waves"
              className="rounded-lg px-3 py-2 text-slate-700 hover:bg-slate-100"
            >
              Waves
            </Link>
            <Link
              href="/dashboard"
              className="rounded-lg px-3 py-2 text-slate-700 hover:bg-slate-100"
            >
              Area Cliente
            </Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>

      <footer className="mx-auto max-w-6xl px-4 pb-10 pt-6 text-xs text-slate-500">
        SPST • Carrier Portal (MVP) — read-only waves + download DDT
      </footer>
    </div>
  );
}
