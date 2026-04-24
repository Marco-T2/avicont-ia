import { redirect } from "next/navigation";
import { requirePermission } from "@/features/permissions/server";
import { AccountBalancesService } from "@/features/account-balances/server";
import { FiscalPeriodsService } from "@/features/fiscal-periods/server";
import BalanceTable from "@/components/accounting/balance-table";

interface BalancesPageProps {
  params: Promise<{ orgSlug: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function BalancesPage({
  params,
  searchParams,
}: BalancesPageProps) {
  const { orgSlug } = await params;
  const sp = await searchParams;

  let orgId: string;
  try {
    const result = await requirePermission("journal", "read", orgSlug);
    orgId = result.orgId;
  } catch {
    redirect(`/${orgSlug}`);
  }

  const periodsService = new FiscalPeriodsService();
  const balancesService = new AccountBalancesService();

  const periods = await periodsService.list(orgId);

  const periodId =
    typeof sp.periodId === "string" ? sp.periodId : undefined;

  const balances = periodId
    ? await balancesService.getBalances(orgId, periodId)
    : [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Saldos de Cuentas</h1>
        <p className="text-gray-500 mt-1">
          Balance de saldos por período fiscal
        </p>
      </div>

      <BalanceTable
        orgSlug={orgSlug}
        periods={JSON.parse(JSON.stringify(periods))}
        balances={JSON.parse(JSON.stringify(balances))}
        selectedPeriodId={periodId}
      />
    </div>
  );
}
