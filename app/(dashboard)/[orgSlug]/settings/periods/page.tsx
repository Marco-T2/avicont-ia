import { redirect } from "next/navigation";
import { requirePermission } from "@/features/permissions/server";
import { FiscalPeriodsService } from "@/features/fiscal-periods/server";
import PeriodList from "@/components/accounting/period-list";

interface PeriodsPageProps {
  params: Promise<{ orgSlug: string }>;
}

export default async function PeriodsPage({ params }: PeriodsPageProps) {
  const { orgSlug } = await params;

  let orgId: string;
  try {
    const result = await requirePermission("period", "read", orgSlug);
    orgId = result.orgId;
  } catch {
    redirect(`/${orgSlug}`);
  }

  const service = new FiscalPeriodsService();
  const periods = await service.list(orgId);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Períodos Fiscales</h1>
        <p className="text-gray-500 mt-1">
          Gestión de períodos contables de la organización
        </p>
      </div>

      <PeriodList
        orgSlug={orgSlug}
        periods={JSON.parse(JSON.stringify(periods))}
      />
    </div>
  );
}
