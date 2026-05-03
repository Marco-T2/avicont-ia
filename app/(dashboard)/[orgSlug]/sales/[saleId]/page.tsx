import { redirect } from "next/navigation";
import { requirePermission } from "@/features/permissions/server";
import { ContactsService } from "@/features/contacts/server";
import { FiscalPeriodsService } from "@/features/fiscal-periods/server";
import { AccountsService } from "@/features/accounting/server";
import { prisma } from "@/lib/prisma";
import type { IvaSalesBookDTO } from "@/features/accounting/iva-books";
import { makeSaleService } from "@/modules/sale/presentation/composition-root";
import {
  toSaleWithDetails,
  computeDisplayCode,
  SALE_PREFIX,
} from "@/modules/sale/presentation/mappers/sale-to-with-details.mapper";
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
  const contactsService = new ContactsService();
  const periodsService = new FiscalPeriodsService();
  const accountsService = new AccountsService();

  let sale;
  try {
    sale = await saleService.getById(orgId, saleId);
  } catch {
    redirect(`/${orgSlug}/sales`);
  }

  const [contacts, periods, accounts, contact, receivable, ivaSalesBook] = await Promise.all([
    contactsService.list(orgId, { type: "CLIENTE", isActive: true }),
    periodsService.list(orgId),
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
    prisma.ivaSalesBook.findUnique({ where: { saleId: sale.id } }),
  ]);

  const period = periods.find((p) => p.id === sale.periodId);
  if (!contact || !period) {
    redirect(`/${orgSlug}/sales`);
  }

  // Prisma IvaSalesBook record fechaFactura:Date vs IvaSalesBookDTO.fechaFactura:string
  // (legacy DTO documents ISO 8601 string post-JSON-serialization). Cast preserva
  // TS type contract; runtime JSON.parse(JSON.stringify(...)) below convierte Date→ISO.
  const saleWithDetails = toSaleWithDetails(sale, {
    contact,
    period,
    receivable,
    ivaSalesBook: ivaSalesBook as unknown as IvaSalesBookDTO | null,
    // §13.AC-sale-paged caller responsibility null guard (A3-C4b.5 paired):
    // DRAFT sales (sequenceNumber=null) usan fallback `${SALE_PREFIX}-DRAFT`
    // mirror §13.AC HubService A3-C5 SubQ-β + A3-C4a.5 sale list precedent.
    displayCode:
      sale.sequenceNumber !== null
        ? computeDisplayCode(sale.sequenceNumber)
        : `${SALE_PREFIX}-DRAFT`,
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
        contacts={JSON.parse(JSON.stringify(contacts))}
        periods={JSON.parse(JSON.stringify(availablePeriods))}
        incomeAccounts={JSON.parse(JSON.stringify(accounts))}
        sale={JSON.parse(JSON.stringify(saleWithDetails))}
        mode="edit"
      />
    </div>
  );
}
