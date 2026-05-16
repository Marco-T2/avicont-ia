import { redirect } from "next/navigation";
import { requirePermission } from "@/features/permissions/server";
import { makeOrgProfileService } from "@/modules/org-profile/presentation/server";
import { makeFiscalPeriodsService } from "@/modules/fiscal-periods/presentation/server";
import { BalanceSheetPageClient } from "@/components/financial-statements/balance-sheet-page-client";

const orgProfileService = makeOrgProfileService();
const fiscalPeriodsService = makeFiscalPeriodsService();

interface BalanceSheetPageProps {
  params: Promise<{ orgSlug: string }>;
}

export default async function BalanceSheetPage({
  params,
}: BalanceSheetPageProps) {
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
        <h1 className="text-3xl font-bold">Balance General</h1>
        <p className="text-muted-foreground mt-1">
          Estado de Situación Patrimonial — Activos, Pasivos y Patrimonio
        </p>
      </div>

      <BalanceSheetPageClient
        orgSlug={orgSlug}
        orgName={orgName}
        periods={JSON.parse(JSON.stringify(periods))}
      />
    </div>
  );
}
