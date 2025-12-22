// app/dashboard/layout.tsx
import AppSidebar from "@/components/AppSidebar";
import AppTopbar from "@/components/AppTopbar";
import Script from "next/script";
import RequireShipperGate from "@/components/RequireShipperGate";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen grid grid-cols-[260px_1fr]">
      <AppSidebar />
      <div className="flex min-h-screen flex-col">
        <AppTopbar />

        <main className="px-8 py-6">
          <RequireShipperGate>{children}</RequireShipperGate>
        </main>

        {/* 1️⃣ Google Maps + Places */}
        <Script
          src={`https://maps.googleapis.com/maps/api/js?key=${
            process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
          }&libraries=places&language=${
            process.env.NEXT_PUBLIC_GOOGLE_MAPS_LANGUAGE || "it"
          }&region=${
            process.env.NEXT_PUBLIC_GOOGLE_MAPS_REGION || "IT"
          }&loading=async`}
          strategy="afterInteractive"
        />

        {/* 2️⃣ Extended Component Library (ESM) */}
        <Script
          type="module"
          crossOrigin="anonymous"
          src="https://unpkg.com/@googlemaps/extended-component-library@0.6/dist/index.min.js"
          strategy="afterInteractive"
        />
      </div>
    </div>
  );
}
