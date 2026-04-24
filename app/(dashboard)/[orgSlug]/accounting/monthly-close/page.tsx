import { redirect } from "next/navigation";
import { requirePermission } from "@/features/permissions/server";
import { FiscalPeriodsService } from "@/features/fiscal-periods/server";
import { MonthlyClosePanel } from "@/components/accounting/monthly-close-panel";

const periodsService = new FiscalPeriodsService();

interface MonthlyClosePageProps {
  params: Promise<{ orgSlug: string }>;
  searchParams: Promise<{ periodId?: string }>;
}

export default async function MonthlyClosePage({ params, searchParams }: MonthlyClosePageProps) {
  const { orgSlug } = await params;
  const { periodId } = await searchParams;

  let orgId: string;
  try {
    const result = await requirePermission("period", "read", orgSlug);
    orgId = result.orgId;
  } catch {
    redirect(`/${orgSlug}`);
  }

  const periods = await periodsService.list(orgId);

  // REQ-2: validate periodId against the server-side period list (org-scoped, no extra round-trip).
  // Only OPEN periods can be pre-selected (a CLOSED period would have nothing to close).
  const preselectedPeriodId =
    periodId && periods.some((p) => p.id === periodId && p.status === "OPEN")
      ? periodId
      : undefined;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Cierre Mensual</h1>
        <p className="text-gray-500 mt-1">
          Revisión y cierre de períodos fiscales
        </p>
      </div>

      <MonthlyClosePanel
        orgSlug={orgSlug}
        preselectedPeriodId={preselectedPeriodId}
        periods={periods.map((p) => ({
          id: p.id,
          name: p.name,
          startDate: p.startDate.toISOString(),
          endDate: p.endDate.toISOString(),
          status: p.status,
        }))}
      />
    </div>
  );
}
