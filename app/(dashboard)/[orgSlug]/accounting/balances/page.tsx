import { redirect } from "next/navigation";
import { requireAuth, requireOrgAccess } from "@/features/shared";
import { AccountBalancesService } from "@/features/account-balances";
import { FiscalPeriodsService } from "@/features/fiscal-periods";
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

  let userId: string;
  try {
    const session = await requireAuth();
    userId = session.userId;
  } catch {
    redirect("/sign-in");
  }

  let orgId: string;
  try {
    orgId = await requireOrgAccess(userId, orgSlug);
  } catch {
    redirect("/select-org");
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
