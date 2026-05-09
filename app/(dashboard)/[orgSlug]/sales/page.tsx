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
import SaleList from "@/components/sales/sale-list";

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
  const result = await saleService.listPaginated(
    orgId,
    statusFilter ? { status: statusFilter } : undefined,
    pagination,
  );
  const sales = result.items;

  const contactIds = [...new Set(sales.map((s) => s.contactId))];
  const periodIds = [...new Set(sales.map((s) => s.periodId))];

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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Ventas General</h1>
        <p className="text-gray-500 mt-1">
          Gestión de ventas y cuentas por cobrar
        </p>
      </div>

      <SaleList
        orgSlug={orgSlug}
        items={JSON.parse(JSON.stringify(salesWithDetails))}
        total={result.total}
        page={result.page}
        pageSize={result.pageSize}
        totalPages={result.totalPages}
        statusFilter={statusFilter}
      />
    </div>
  );
}
