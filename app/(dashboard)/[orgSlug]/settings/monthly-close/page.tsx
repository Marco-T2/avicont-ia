import { redirect } from "next/navigation";
import { requireAuth, requireOrgAccess, requireRole } from "@/features/shared/middleware";
import { FiscalPeriodsService } from "@/features/fiscal-periods";
import { MonthlyClosePanel } from "@/components/settings/monthly-close-panel";

const periodsService = new FiscalPeriodsService();

interface MonthlyClosePageProps {
  params: Promise<{ orgSlug: string }>;
}

export default async function MonthlyClosePage({ params }: MonthlyClosePageProps) {
  const { orgSlug } = await params;

  let orgId: string;
  try {
    const session = await requireAuth();
    const userId = session.userId;
    orgId = await requireOrgAccess(userId, orgSlug);
    await requireRole(userId, orgId, ["owner", "admin"]);
  } catch {
    redirect("/sign-in");
  }

  const periods = await periodsService.list(orgId!);

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
