import { redirect } from "next/navigation";
import { requirePermission } from "@/features/permissions/server";
import { makeContactsService } from "@/modules/contacts/presentation/server";
import type { Contact } from "@/modules/contacts/presentation/index";
import { makeFiscalPeriodsService } from "@/modules/fiscal-periods/presentation/server";
import { makeAccountsService } from "@/modules/accounting/presentation/server";
import { prisma } from "@/lib/prisma";
import { makeSaleService } from "@/modules/sale/presentation/composition-root";
import { toSaleWithDetails } from "@/modules/sale/presentation/mappers/sale-to-with-details.mapper";
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

  const saleService = makeSaleService();
  const contactsService = makeContactsService();
  const periodsService = makeFiscalPeriodsService();
  const accountsService = makeAccountsService();

  let sale;
  try {
    sale = await saleService.getById(orgId, saleId);
  } catch {
    redirect(`/${orgSlug}/sales`);
  }

  const [contacts, periods, accounts, contact, receivable] = await Promise.all([
    contactsService.list(orgId, { type: "CLIENTE", isActive: true }).then((entities) => entities.map((c) => c.toSnapshot())),
    periodsService.list(orgId).then((entities) => entities.map((p) => p.toSnapshot())),
    accountsService.list(orgId, { type: "INGRESO", isDetail: true, isActive: true }),
    prisma.contact.findUnique({
      where: { id: sale.contactId },
      select: {
        id: true,
        name: true,
        type: true,
        nit: true,
        paymentTermsDays: true,
      },
    }),
    sale.receivableId
      ? prisma.accountsReceivable.findUnique({
          where: { id: sale.receivableId },
          select: {
            id: true,
            amount: true,
            paid: true,
            balance: true,
            status: true,
            dueDate: true,
            allocations: {
              select: {
                id: true,
                paymentId: true,
                amount: true,
                payment: {
                  select: { id: true, date: true, description: true },
                },
              },
              orderBy: { payment: { date: "asc" as const } },
            },
          },
        })
      : Promise.resolve(null),
  ]);

  const period = periods.find((p) => p.id === sale.periodId);
  if (!contact || !period) {
    redirect(`/${orgSlug}/sales`);
  }

  const saleWithDetails = toSaleWithDetails(sale, {
    contact,
    period,
    receivable,
  });

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
        contacts={contacts as unknown as Contact[]}
        periods={JSON.parse(JSON.stringify(availablePeriods))}
        incomeAccounts={JSON.parse(JSON.stringify(accounts))}
        sale={JSON.parse(JSON.stringify(saleWithDetails))}
        mode="edit"
      />
    </div>
  );
}
