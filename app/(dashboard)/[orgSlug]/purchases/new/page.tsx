import { redirect } from "next/navigation";
import { requireAuth, requireOrgAccess } from "@/features/shared";
import { ContactsService } from "@/features/contacts";
import { FiscalPeriodsService } from "@/features/fiscal-periods";
import { ProductTypesService } from "@/features/product-types";
import PurchaseForm from "@/components/purchases/purchase-form";
import type { PurchaseType } from "@/features/purchase";

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

  let userId: string;
  try {
    const session = await requireAuth();
    userId = session.userId;
  } catch {
    redirect("/sign-in");
  }

  let orgId: string;
  try {
    orgId = await requireOrgAccess(userId, orgSlug);
  } catch {
    redirect("/select-org");
  }

  const contactsService = new ContactsService();
  const periodsService = new FiscalPeriodsService();
  const productTypesService = new ProductTypesService();

  const [contacts, periods, productTypes] = await Promise.all([
    contactsService.list(orgId, { type: "PROVEEDOR", isActive: true }),
    periodsService.list(orgId),
    productTypesService.list(orgId, { isActive: true }),
  ]);

  // Only show OPEN periods
  const openPeriods = periods.filter((p) => p.status === "OPEN");

  return (
    <div className="space-y-6">
      <PurchaseForm
        orgSlug={orgSlug}
        purchaseType={purchaseType}
        contacts={JSON.parse(JSON.stringify(contacts))}
        periods={JSON.parse(JSON.stringify(openPeriods))}
        productTypes={JSON.parse(JSON.stringify(productTypes))}
        mode="new"
      />
    </div>
  );
}
