// app/carrier/layout.tsx
import Link from "next/link";
import Image from "next/image";
import React from "react";
import { LogOut } from "lucide-react";

/* Icona WhatsApp (SVG inline, no dipendenze esterne) */
function WhatsAppIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      {...props}
    >
      <path d="M20.52 3.48A11.91 11.91 0 0 0 12.04 0C5.41 0 .02 5.39.02 12.02c0 2.12.55 4.19 1.6 6.01L0 24l6.15-1.6a11.95 11.95 0 0 0 5.9 1.5h.01c6.63 0 12.02-5.39 12.02-12.02a11.9 11.9 0 0 0-3.56-8.4zM12.06 21.9h-.01a9.9 9.9 0 0 1-5.04-1.38l-.36-.21-3.65.95.97-3.56-.24-.37a9.9 9.9 0 1 1 8.33 4.57zm5.43-7.41c-.3-.15-1.77-.87-2.04-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.95 1.17-.17.2-.35.22-.65.07-.3-.15-1.25-.46-2.38-1.47-.88-.78-1.48-1.74-1.65-2.03-.17-.3-.02-.46.13-.61.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.07-.15-.67-1.62-.92-2.22-.24-.58-.48-.5-.67-.51h-.57c-.2 0-.52.07-.8.37-.27.3-1.05 1.03-1.05 2.52 0 1.5 1.08 2.94 1.23 3.14.15.2 2.13 3.26 5.16 4.57.72.31 1.28.5 1.72.64.72.23 1.37.2 1.88.12.57-.08 1.77-.72 2.02-1.42.25-.7.25-1.3.17-1.42-.07-.12-.27-.2-.57-.35z" />
    </svg>
  );
}

export const dynamic = "force-dynamic";

export default function CarrierLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const whatsappUrl =
    process.env.NEXT_PUBLIC_WHATSAPP_LINK ||
    'https://wa.me/message/CP62RMFFDNZPO1';

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="sticky top-0 z-10 border-b bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="relative h-9 w-9">
              <Image
                src="/spst-logo.png"
                alt="SPST"
                fill
                className="object-contain"
                priority
              />
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
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-lg bg-[#25D366] px-3 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-[#1ebe5d] focus:outline-none focus:ring-2 focus:ring-[#25D366]/40"
            >
              <WhatsAppIcon className="h-4 w-4" />
              Supporto WhatsApp
            </a>
            <Link
              href="/logout"
              className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-900/40"
            >
              <LogOut className="h-4 w-4" />
              Logout
            </Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
    </div>
  );
}
