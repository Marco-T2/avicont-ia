import { redirect } from "next/navigation";
import { requirePermission } from "@/features/shared/permissions.server";
import { PurchaseService } from "@/features/purchase";
import { ContactsService } from "@/features/contacts";
import { FiscalPeriodsService } from "@/features/fiscal-periods";
import { ProductTypesService } from "@/features/product-types";
import PurchaseForm from "@/components/purchases/purchase-form";
import type { PurchaseType } from "@/features/purchase";

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

  const purchaseService = new PurchaseService();
  const contactsService = new ContactsService();
  const periodsService = new FiscalPeriodsService();
  const productTypesService = new ProductTypesService();

  let purchase;
  try {
    purchase = await purchaseService.getById(orgId, purchaseId);
  } catch {
    redirect(`/${orgSlug}/purchases`);
  }

  const [contacts, periods, productTypes] = await Promise.all([
    contactsService.list(orgId, { type: "PROVEEDOR", isActive: true }),
    periodsService.list(orgId),
    productTypesService.list(orgId, { isActive: true }),
  ]);

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
        contacts={JSON.parse(JSON.stringify(contacts))}
        periods={JSON.parse(JSON.stringify(availablePeriods))}
        productTypes={JSON.parse(JSON.stringify(productTypes))}
        purchase={JSON.parse(JSON.stringify(purchase))}
        mode="edit"
      />
    </div>
  );
}
