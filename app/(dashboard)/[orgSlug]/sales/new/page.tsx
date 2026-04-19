import { redirect } from "next/navigation";
import { requirePermission } from "@/features/shared/permissions.server";
import { ContactsService } from "@/features/contacts";
import { FiscalPeriodsService } from "@/features/fiscal-periods";
import { AccountsService } from "@/features/accounting";
import SaleForm from "@/components/sales/sale-form";

interface NewSalePageProps {
  params: Promise<{ orgSlug: string }>;
}

export default async function NewSalePage({ params }: NewSalePageProps) {
  const { orgSlug } = await params;

  let orgId: string;
  try {
    const result = await requirePermission("sales", "write", orgSlug);
    orgId = result.orgId;
  } catch {
    redirect(`/${orgSlug}`);
  }

  const contactsService = new ContactsService();
  const periodsService = new FiscalPeriodsService();
  const accountsService = new AccountsService();

  const [contacts, periods, accounts] = await Promise.all([
    contactsService.list(orgId, { type: "CLIENTE", isActive: true }),
    periodsService.list(orgId),
    accountsService.list(orgId, { type: "INGRESO", isDetail: true, isActive: true }),
  ]);

  // Solo mostrar períodos abiertos
  const openPeriods = periods.filter((p) => p.status === "OPEN");

  return (
    <div className="space-y-6">
      <SaleForm
        orgSlug={orgSlug}
        contacts={JSON.parse(JSON.stringify(contacts))}
        periods={JSON.parse(JSON.stringify(openPeriods))}
        incomeAccounts={JSON.parse(JSON.stringify(accounts))}
        mode="new"
      />
    </div>
  );
}
