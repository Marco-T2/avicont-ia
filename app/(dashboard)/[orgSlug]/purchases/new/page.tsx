import { redirect } from "next/navigation";
import { requirePermission } from "@/features/permissions/server";
import { makeContactsService } from "@/modules/contacts/presentation/server";
import type { Contact } from "@/modules/contacts/presentation/index";
import { makeFiscalPeriodsService } from "@/modules/fiscal-periods/presentation/server";
import { makeProductTypeService } from "@/modules/product-type/presentation/server";
import { makeAccountsService } from "@/modules/accounting/presentation/server";
import PurchaseForm from "@/components/purchases/purchase-form";
import type { PurchaseType } from "@/modules/purchase/presentation/dto/purchase-with-details";

interface NewPurchasePageProps {
  params: Promise<{ orgSlug: string }>;
  searchParams: Promise<{ type?: string }>;
}

const VALID_PURCHASE_TYPES: PurchaseType[] = [
  "FLETE",
  "POLLO_FAENADO",
  "COMPRA_GENERAL",
  "SERVICIO",
];

export default async function NewPurchasePage({
  params,
  searchParams,
}: NewPurchasePageProps) {
  const { orgSlug } = await params;
  const { type } = await searchParams;

  // Validate purchase type from query param
  if (!type || !VALID_PURCHASE_TYPES.includes(type as PurchaseType)) {
    redirect(`/${orgSlug}/purchases`);
  }

  const purchaseType = type as PurchaseType;

  let orgId: string;
  try {
    const result = await requirePermission("purchases", "write", orgSlug);
    orgId = result.orgId;
  } catch {
    redirect(`/${orgSlug}`);
  }

  const contactsService = makeContactsService();
  const periodsService = makeFiscalPeriodsService();
  const productTypesService = makeProductTypeService();
  const accountsService = makeAccountsService();

  const [contacts, periods, productTypes, expenseAccounts] = await Promise.all([
    contactsService.list(orgId, { type: "PROVEEDOR", isActive: true }).then((entities) => entities.map((c) => c.toSnapshot())),
    periodsService.list(orgId).then((entities) => entities.map((p) => p.toSnapshot())),
    productTypesService.list(orgId, { isActive: true }).then((entities) => entities.map((pt) => pt.toSnapshot())),
    accountsService.list(orgId, { type: "GASTO", isDetail: true, isActive: true }),
  ]);

  // Only show OPEN periods
  const openPeriods = periods.filter((p) => p.status === "OPEN");

  return (
    <div className="space-y-6">
      <PurchaseForm
        orgSlug={orgSlug}
        purchaseType={purchaseType}
        contacts={contacts as unknown as Contact[]}
        periods={JSON.parse(JSON.stringify(openPeriods))}
        productTypes={JSON.parse(JSON.stringify(productTypes))}
        expenseAccounts={JSON.parse(JSON.stringify(expenseAccounts))}
        mode="new"
      />
    </div>
  );
}
