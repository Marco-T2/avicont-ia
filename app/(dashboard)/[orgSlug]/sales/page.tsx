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

  const typeFilter = typeof sp.type === "string" ? sp.type : undefined;
  const periodIdFilter = typeof sp.periodId === "string" ? sp.periodId : undefined;

  const saleService = makeSaleService();
  const dispatchService = makeDispatchService();

  // Cross-module twin-call UNION pagination (D1 design): presentation-layer
  // composition, NO merge service per §13.dispatch.cross-module-direct-read.
  // Both services paginate INDEPENDENTLY at (page, pageSize); RSC sums totals
  // and re-sorts the merged page-window per AD-3 (poc-sales-unified-pagination).
  //
  // Dispatch filter mapping: `?type=NOTA_DESPACHO|BOLETA_CERRADA` →
  // `dispatchType`; `?type=VENTA_GENERAL` is a sale-only filter (dispatch
  // returns empty in that case via mismatched dispatchType filter, but we
  // skip the dispatch call's dispatchType when type=VENTA_GENERAL).
  const dispatchTypeFilter =
    typeFilter === "NOTA_DESPACHO" || typeFilter === "BOLETA_CERRADA"
      ? typeFilter
      : undefined;
  const [result, dispatchResult] = await Promise.all([
    saleService.listPaginated(
      orgId,
      {
        ...(statusFilter ? { status: statusFilter } : {}),
        ...(periodIdFilter ? { periodId: periodIdFilter } : {}),
      },
      pagination,
    ),
    dispatchService.listPaginated(
      orgId,
      {
        ...(statusFilter
          ? { status: statusFilter as "DRAFT" | "POSTED" | "LOCKED" | "VOIDED" }
          : {}),
        ...(dispatchTypeFilter ? { dispatchType: dispatchTypeFilter } : {}),
        ...(periodIdFilter ? { periodId: periodIdFilter } : {}),
      },
      pagination,
    ),
  ]);
  const sales = result.items;
  const dispatches = dispatchResult.items;

  // UNION pagination math (AD-3): sum the per-source totals; recompute
  // totalPages from the union total. Acceptable over-fetch tradeoff
  // documented in §13.dispatch.sales-unified-pagination-union-cascade
  // (each source fetches up to `pageSize`; RSC renders `pageSize` of up
  // to `2 × pageSize` candidates).
  const unionTotal = result.total + dispatchResult.total;
  const unionTotalPages = Math.max(1, Math.ceil(unionTotal / pagination.pageSize));

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
  // discriminated union from hub.types.ts deleted in C1). UNION pagination
  // page-window: RSC re-sorts merged candidates by (createdAt DESC, id DESC)
  // tiebreaker (AD-2 poc-sales-unified-pagination) and slices to `pageSize`.
  const mergedRows = [
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

  // Sort merged page-window: createdAt DESC primary; id DESC tiebreaker
  // (AD-2 — deterministic, source-agnostic). `date` is the canonical
  // chronological field rendered to user; `id` (UUID) breaks ties.
  const transactionRows = mergedRows
    .sort((a, b) => {
      const dateDiff = b.date.getTime() - a.date.getTime();
      if (dateDiff !== 0) return dateDiff;
      return b.id.localeCompare(a.id);
    })
    .slice(0, pagination.pageSize);

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
        total={unionTotal}
        page={pagination.page}
        pageSize={pagination.pageSize}
        totalPages={unionTotalPages}
        periods={periods.map((p) => ({ id: p.id, name: p.name }))}
        filters={{
          status: statusFilter,
          type: typeFilter,
          periodId: periodIdFilter,
        }}
      />
    </div>
  );
}
