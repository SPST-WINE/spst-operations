// File: app/usa-shipping-pay/page.tsx
import DutiesForm from "@/components/duties/DutiesForm";

export default function DutiesPage() {
  return (
    <main className="min-h-screen bg-[#0a1722] text-white p-6">
      <div className="max-w-2xl mx-auto mt-10 bg-white/10 backdrop-blur-md p-8 rounded-2xl border border-white/10">
        <h1 className="text-3xl font-bold mb-6">Create US Duties Payment Link</h1>
        <p className="mb-6 text-white/80">
          Generate a payment link for custom duties to send to the customer.
        </p>
        <DutiesForm />
      </div>
    </main>
  );
}
