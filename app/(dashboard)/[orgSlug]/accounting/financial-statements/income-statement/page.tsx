import { redirect } from "next/navigation";
import { requirePermission } from "@/features/permissions/server";
import { makeOrgProfileService } from "@/modules/org-profile/presentation/server";
import { makeFiscalPeriodsService } from "@/modules/fiscal-periods/presentation/server";
import { IncomeStatementPageClient } from "@/components/financial-statements/income-statement-page-client";

const orgProfileService = makeOrgProfileService();
const fiscalPeriodsService = makeFiscalPeriodsService();

interface IncomeStatementPageProps {
  params: Promise<{ orgSlug: string }>;
}

export default async function IncomeStatementPage({
  params,
}: IncomeStatementPageProps) {
  const { orgSlug } = await params;

  let orgId: string;
  try {
    const result = await requirePermission("reports", "read", orgSlug);
    orgId = result.orgId;
  } catch {
    redirect(`/${orgSlug}`);
  }

  const [profile, periods] = await Promise.all([
    orgProfileService.getOrCreate(orgId),
    fiscalPeriodsService.list(orgId).then((entities) => entities.map((p) => p.toSnapshot())),
  ]);
  const orgName = profile.razonSocial.trim() || undefined;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Estado de Resultados</h1>
        <p className="text-muted-foreground mt-1">
          Análisis de Ingresos y Gastos por período o rango de fechas
        </p>
      </div>

      <IncomeStatementPageClient
        orgSlug={orgSlug}
        orgName={orgName}
        periods={JSON.parse(JSON.stringify(periods))}
      />
    </div>
  );
}
