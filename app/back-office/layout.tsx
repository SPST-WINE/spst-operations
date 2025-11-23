// app/back-office/layout.tsx
import type { ReactNode } from "react";
import BackofficeSidebar from "@/components/backoffice/BackofficeSidebar";
import BackofficeTopbar from "@/components/backoffice/BackofficeTopbar";

export default function BackofficeLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen grid grid-cols-[260px_1fr]">
      <BackofficeSidebar />
      <div className="flex min-h-screen flex-col bg-slate-50">
        <BackofficeTopbar />
        <main className="px-8 py-6">
          {children}
        </main>
      </div>
    </div>
  );
}
