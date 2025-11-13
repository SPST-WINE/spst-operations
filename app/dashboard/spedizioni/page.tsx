// app/dashboard/spedizioni/page.tsx
import SpedizioniClient from '@/components/SpedizioniClient';

export const dynamic = 'force-dynamic';

export default function MyShipmentsPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-slate-800">Le mie spedizioni</h1>
      <SpedizioniClient />
    </div>
  );
}
