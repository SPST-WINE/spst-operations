import BackofficeStatusClient from "@/components/backoffice/BackofficeStatusClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function BackofficeStatusPage() {
  return (
    <div className="p-4 md:p-6">
      <BackofficeStatusClient />
    </div>
  );
}
