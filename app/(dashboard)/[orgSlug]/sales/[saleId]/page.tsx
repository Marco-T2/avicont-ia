import { redirect } from "next/navigation";
import { requirePermission } from "@/features/shared/permissions.server";
import { SaleService } from "@/features/sale";
import { ContactsService } from "@/features/contacts";
import { FiscalPeriodsService } from "@/features/fiscal-periods/server";
import { AccountsService } from "@/features/accounting";
import SaleForm from "@/components/sales/sale-form";

interface SaleDetailPageProps {
  params: Promise<{ orgSlug: string; saleId: string }>;
}

export default async function SaleDetailPage({ params }: SaleDetailPageProps) {
  const { orgSlug, saleId } = await params;

  let orgId: string;
  try {
    const result = await requirePermission("sales", "write", orgSlug);
    orgId = result.orgId;
  } catch {
    redirect(`/${orgSlug}`);
  }

  const saleService = new SaleService();
  const contactsService = new ContactsService();
  const periodsService = new FiscalPeriodsService();
  const accountsService = new AccountsService();

  let sale;
  try {
    sale = await saleService.getById(orgId, saleId);
  } catch {
    redirect(`/${orgSlug}/sales`);
  }

  const [contacts, periods, accounts] = await Promise.all([
    contactsService.list(orgId, { type: "CLIENTE", isActive: true }),
    periodsService.list(orgId),
    accountsService.list(orgId, { type: "INGRESO", isDetail: true, isActive: true }),
  ]);

  // Períodos abiertos; garantizar que el período actual de la venta esté incluido aunque esté cerrado
  const openPeriods = periods.filter((p) => p.status === "OPEN");
  const salePeriodIncluded = openPeriods.some((p) => p.id === sale.periodId);
  const availablePeriods = salePeriodIncluded
    ? openPeriods
    : [
        ...openPeriods,
        ...periods.filter((p) => p.id === sale.periodId),
      ];

  return (
    <div className="space-y-6">
      <SaleForm
        orgSlug={orgSlug}
        contacts={JSON.parse(JSON.stringify(contacts))}
        periods={JSON.parse(JSON.stringify(availablePeriods))}
        incomeAccounts={JSON.parse(JSON.stringify(accounts))}
        sale={JSON.parse(JSON.stringify(sale))}
        mode="edit"
      />
    </div>
  );
}
