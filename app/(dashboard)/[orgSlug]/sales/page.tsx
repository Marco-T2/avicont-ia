import { redirect } from "next/navigation";
import { requirePermission } from "@/features/permissions/server";
import { prisma } from "@/lib/prisma";
import { makeSaleService } from "@/modules/sale/presentation/composition-root";
import {
  toSaleWithDetails,
  computeDisplayCode,
  SALE_PREFIX,
} from "@/modules/sale/presentation/mappers/sale-to-with-details.mapper";
import { paginationQuerySchema } from "@/modules/shared/presentation/pagination.schema";
import { makeDispatchService } from "@/modules/dispatch/presentation/composition-root";
import { getDisplayCode as getDispatchDisplayCode } from "@/modules/dispatch/infrastructure/dispatch-display-code";
import TransactionsList from "@/components/sales/transactions-list";

interface SalesPageProps {
  params: Promise<{ orgSlug: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function SalesPage({ params, searchParams }: SalesPageProps) {
  const { orgSlug } = await params;
  const sp = await searchParams;

  let orgId: string;
  try {
    const result = await requirePermission("sales", "read", orgSlug);
    orgId = result.orgId;
  } catch {
    redirect(`/${orgSlug}`);
  }

  const pagination = paginationQuerySchema.parse({
    page: sp.page,
    pageSize: sp.pageSize,
  });
  const statusFilter = typeof sp.status === "string" ? sp.status : undefined;

  const saleService = makeSaleService();
  const dispatchService = makeDispatchService();

  // Cross-module twin-call (D1 design): presentation-layer composition, NO merge
  // service. Sale section paginated (B5 lock preserved); BC + ND non-paginated
  // alongside per Marco resolution in spec #2483.
  const [result, dispatches] = await Promise.all([
    saleService.listPaginated(
      orgId,
      statusFilter ? { status: statusFilter } : undefined,
      pagination,
    ),
    dispatchService.list(
      orgId,
      statusFilter
        ? { status: statusFilter as "DRAFT" | "POSTED" | "LOCKED" | "VOIDED" }
        : undefined,
    ),
  ]);
  const sales = result.items;

  const contactIds = [
    ...new Set([
      ...sales.map((s) => s.contactId),
      ...dispatches.map((d) => d.contactId),
    ]),
  ];
  const periodIds = [
    ...new Set([
      ...sales.map((s) => s.periodId),
      ...dispatches.map((d) => d.periodId),
    ]),
  ];

  const [contacts, periods] = await Promise.all([
    prisma.contact.findMany({
      where: { id: { in: contactIds } },
      select: {
        id: true,
        name: true,
        type: true,
        nit: true,
        paymentTermsDays: true,
      },
    }),
    prisma.fiscalPeriod.findMany({
      where: { id: { in: periodIds } },
      select: { id: true, name: true, status: true },
    }),
  ]);

  const contactMap = new Map(contacts.map((c) => [c.id, c]));
  const periodMap = new Map(periods.map((p) => [p.id, p]));

  const salesWithDetails = sales.map((s) =>
    toSaleWithDetails(s, {
      contact: contactMap.get(s.contactId)!,
      period: periodMap.get(s.periodId)!,
      receivable: null,
      ivaSalesBook: null,
      // §13.AC-sale-paged caller responsibility null guard (A3-C4a.5 paired):
      // DRAFT sales (sequenceNumber=null) usan fallback `${SALE_PREFIX}-DRAFT`
      // mirror §13.AC HubService A3-C5 SubQ-β. computeDisplayCode standalone
      // SubQ-d fail-fast invariant preservado.
      displayCode:
        s.sequenceNumber !== null
          ? computeDisplayCode(s.sequenceNumber)
          : `${SALE_PREFIX}-DRAFT`,
    }),
  );

  // Source discriminator merge (presentation-local; replaces retired HubItem
  // discriminated union from hub.types.ts deleted in C1). Sale section
  // preserves listPaginated paging meta; dispatch rows non-paginated alongside
  // per B5 lock (defer UNION pagination per mathematical correctness).
  const transactionRows = [
    ...salesWithDetails.map((s) => ({
      source: "sale" as const,
      type: "VENTA_GENERAL" as const,
      id: s.id,
      displayCode: s.displayCode,
      referenceNumber: s.referenceNumber,
      date: s.date,
      contactId: s.contactId,
      contactName: contactMap.get(s.contactId)?.name ?? "",
      periodId: s.periodId,
      description: s.description,
      totalAmount: s.totalAmount.toFixed(2),
      status: s.status,
    })),
    ...dispatches.map((d) => ({
      source: "dispatch" as const,
      type: d.dispatchType,
      id: d.id,
      displayCode: getDispatchDisplayCode(d.dispatchType, d.sequenceNumber),
      referenceNumber: d.referenceNumber,
      date: d.date,
      contactId: d.contactId,
      contactName: contactMap.get(d.contactId)?.name ?? "",
      periodId: d.periodId,
      description: d.description,
      totalAmount: d.totalAmount.toFixed(2),
      status: d.status,
    })),
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Ventas General</h1>
        <p className="text-gray-500 mt-1">
          Gestión de ventas y cuentas por cobrar
        </p>
      </div>

      <TransactionsList
        orgSlug={orgSlug}
        items={JSON.parse(JSON.stringify(transactionRows))}
        periods={periods.map((p) => ({ id: p.id, name: p.name }))}
        filters={{
          status: statusFilter,
        }}
      />
    </div>
  );
}
