import { redirect } from "next/navigation";
import { requirePermission } from "@/features/permissions/server";
import { prisma } from "@/lib/prisma";
import { makePurchaseService } from "@/modules/purchase/presentation/composition-root";
import {
  toPurchaseWithDetails,
  computeDisplayCode,
  TYPE_PREFIXES,
} from "@/modules/purchase/presentation/mappers/purchase-to-with-details.mapper";
import { paginationQuerySchema } from "@/modules/shared/presentation/pagination.schema";
import type { PurchaseFilters } from "@/modules/purchase/domain/ports/purchase.repository";
import type { PurchaseType } from "@/modules/purchase/domain/purchase.entity";
import PurchaseList from "@/components/purchases/purchase-list";

interface PurchasesPageProps {
  params: Promise<{ orgSlug: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

const VALID_PURCHASE_TYPES: PurchaseType[] = [
  "FLETE",
  "POLLO_FAENADO",
  "COMPRA_GENERAL",
  "SERVICIO",
];

export default async function PurchasesPage({ params, searchParams }: PurchasesPageProps) {
  const { orgSlug } = await params;
  const sp = await searchParams;

  let orgId: string;
  try {
    const result = await requirePermission("purchases", "read", orgSlug);
    orgId = result.orgId;
  } catch {
    redirect(`/${orgSlug}`);
  }

  const pagination = paginationQuerySchema.parse({
    page: sp.page,
    pageSize: sp.pageSize,
  });
  const typeUiParam = typeof sp.purchaseType === "string" ? sp.purchaseType : undefined;
  const statusFilter = typeof sp.status === "string" ? sp.status : undefined;

  const filtersBuild: PurchaseFilters = {};
  if (typeUiParam === "COMPRA_GENERAL_O_SERVICIO") {
    filtersBuild.purchaseTypeIn = ["COMPRA_GENERAL", "SERVICIO"];
  } else if (
    typeUiParam &&
    VALID_PURCHASE_TYPES.includes(typeUiParam as PurchaseType)
  ) {
    filtersBuild.purchaseType = typeUiParam as PurchaseType;
  }
  if (statusFilter) {
    filtersBuild.status = statusFilter;
  }
  const filters: PurchaseFilters | undefined =
    Object.keys(filtersBuild).length > 0 ? filtersBuild : undefined;

  const purchaseService = makePurchaseService();
  const result = await purchaseService.listPaginated(orgId, filters, pagination);
  const purchases = result.items;

  const contactIds = [...new Set(purchases.map((p) => p.contactId))];
  const periodIds = [...new Set(purchases.map((p) => p.periodId))];

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

  const purchasesWithDetails = purchases.map((p) =>
    toPurchaseWithDetails(p, {
      contact: contactMap.get(p.contactId)!,
      period: periodMap.get(p.periodId)!,
      payable: null,
      ivaPurchaseBook: null,
      // §13.AC-purchase caller responsibility null guard (A3-C6a desde inicio):
      // DRAFT purchases (sequenceNumber=null) usan fallback polymorphic
      // `${TYPE_PREFIXES[purchaseType]}-DRAFT` per purchaseType discriminator
      // mirror §13.AC HubService A3-C5 SubQ-β + A3-C4a.5 sale paired pattern.
      displayCode:
        p.sequenceNumber !== null
          ? computeDisplayCode(p.purchaseType, p.sequenceNumber)
          : `${TYPE_PREFIXES[p.purchaseType]}-DRAFT`,
    }),
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Compras</h1>
        <p className="text-gray-500 mt-1">
          Gestión de fletes, pollos faenados, compras generales y servicios
        </p>
      </div>

      <PurchaseList
        orgSlug={orgSlug}
        items={JSON.parse(JSON.stringify(purchasesWithDetails))}
        total={result.total}
        page={result.page}
        pageSize={result.pageSize}
        totalPages={result.totalPages}
        typeFilter={typeUiParam}
        statusFilter={statusFilter}
      />
    </div>
  );
}
