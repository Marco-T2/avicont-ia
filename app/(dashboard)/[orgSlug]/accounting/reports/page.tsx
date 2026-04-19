import { redirect } from "next/navigation";
import { requirePermission } from "@/features/shared/permissions.server";
import ReportsPageClient from "@/components/accounting/reports-page-client";

interface ReportsPageProps {
  params: Promise<{ orgSlug: string }>;
}

export default async function ReportsPage({ params }: ReportsPageProps) {
  const { orgSlug } = await params;

  try {
    await requirePermission("reports", "read", orgSlug);
  } catch {
    redirect(`/${orgSlug}`);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Reportes Contables</h1>
        <p className="text-gray-500 mt-1">
          Balance de comprobacion y reportes financieros
        </p>
      </div>

      <ReportsPageClient orgSlug={orgSlug} />
    </div>
  );
}
