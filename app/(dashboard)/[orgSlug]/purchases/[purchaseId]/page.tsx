import { redirect } from "next/navigation";
import { requirePermission } from "@/features/permissions/server";
import { makeContactsService } from "@/modules/contacts/presentation/server";
import type { Contact } from "@/modules/contacts/presentation/index";
import { makeFiscalPeriodsService } from "@/modules/fiscal-periods/presentation/server";
import { makeProductTypeService } from "@/modules/product-type/presentation/server";
import { makeAccountsService } from "@/modules/accounting/presentation/server";
import { prisma } from "@/lib/prisma";
import { makePurchaseService } from "@/modules/purchase/presentation/composition-root";
import { toPurchaseWithDetails } from "@/modules/purchase/presentation/mappers/purchase-to-with-details.mapper";
import PurchaseForm from "@/components/purchases/purchase-form";
import type { PurchaseType } from "@/modules/purchase/presentation/dto/purchase-with-details";

interface PurchaseDetailPageProps {
  params: Promise<{ orgSlug: string; purchaseId: string }>;
}

export default async function PurchaseDetailPage({
  params,
}: PurchaseDetailPageProps) {
  const { orgSlug, purchaseId } = await params;

  let orgId: string;
  try {
    const result = await requirePermission("purchases", "write", orgSlug);
    orgId = result.orgId;
  } catch {
    redirect(`/${orgSlug}`);
  }

  const purchaseService = makePurchaseService();
  const contactsService = makeContactsService();
  const periodsService = makeFiscalPeriodsService();
  const productTypesService = makeProductTypeService();
  const accountsService = makeAccountsService();

  let purchase;
  try {
    purchase = await purchaseService.getById(orgId, purchaseId);
  } catch {
    redirect(`/${orgSlug}/purchases`);
  }

  const [contacts, periods, productTypes, expenseAccounts, contact, payable] = await Promise.all([
    contactsService.list(orgId, { type: "PROVEEDOR", isActive: true }).then((entities) => entities.map((c) => c.toSnapshot())),
    periodsService.list(orgId).then((entities) => entities.map((p) => p.toSnapshot())),
    productTypesService.list(orgId, { isActive: true }).then((entities) => entities.map((pt) => pt.toSnapshot())),
    accountsService.list(orgId, { type: "GASTO", isDetail: true, isActive: true }),
    prisma.contact.findUnique({
      where: { id: purchase.contactId },
      select: {
        id: true,
        name: true,
        type: true,
        nit: true,
        paymentTermsDays: true,
      },
    }),
    purchase.payableId
      ? prisma.accountsPayable.findUnique({
          where: { id: purchase.payableId },
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

  const period = periods.find((p) => p.id === purchase.periodId);
  if (!contact || !period) {
    redirect(`/${orgSlug}/purchases`);
  }

  const purchaseWithDetails = toPurchaseWithDetails(purchase, {
    contact,
    period,
    payable,
  });

  // Open periods for editing; ensure current purchase period is included even if closed
  const openPeriods = periods.filter((p) => p.status === "OPEN");
  const purchasePeriodIncluded = openPeriods.some((p) => p.id === purchase.periodId);
  const availablePeriods = purchasePeriodIncluded
    ? openPeriods
    : [
        ...openPeriods,
        ...periods.filter((p) => p.id === purchase.periodId),
      ];

  return (
    <div className="space-y-6">
      <PurchaseForm
        orgSlug={orgSlug}
        purchaseType={purchase.purchaseType as PurchaseType}
        contacts={contacts as unknown as Contact[]}
        periods={JSON.parse(JSON.stringify(availablePeriods))}
        productTypes={JSON.parse(JSON.stringify(productTypes))}
        expenseAccounts={JSON.parse(JSON.stringify(expenseAccounts))}
        purchase={JSON.parse(JSON.stringify(purchaseWithDetails))}
        mode="edit"
      />
    </div>
  );
}
