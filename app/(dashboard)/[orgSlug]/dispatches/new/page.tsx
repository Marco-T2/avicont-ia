import { redirect } from "next/navigation";
import { requirePermission } from "@/features/shared/permissions.server";
import { ContactsService } from "@/features/contacts/server";
import { FiscalPeriodsService } from "@/features/fiscal-periods/server";
import { ProductTypesService } from "@/features/product-types/server";
import { OrgSettingsService } from "@/features/org-settings/server";
import DispatchForm from "@/components/dispatches/dispatch-form";

interface NewDispatchPageProps {
  params: Promise<{ orgSlug: string }>;
  searchParams: Promise<{ type?: string }>;
}

export default async function NewDispatchPage({
  params,
  searchParams,
}: NewDispatchPageProps) {
  const { orgSlug } = await params;
  const { type } = await searchParams;

  // Validate dispatch type from query param
  if (type !== "NOTA_DESPACHO" && type !== "BOLETA_CERRADA") {
    redirect(`/${orgSlug}/dispatches`);
  }

  let orgId: string;
  try {
    const result = await requirePermission("sales", "write", orgSlug);
    orgId = result.orgId;
  } catch {
    redirect(`/${orgSlug}`);
  }

  const contactsService = new ContactsService();
  const periodsService = new FiscalPeriodsService();
  const productTypesService = new ProductTypesService();
  const orgSettingsService = new OrgSettingsService();

  const [contacts, periods, productTypes, orgSettings] = await Promise.all([
    contactsService.list(orgId, { type: "CLIENTE", isActive: true }),
    periodsService.list(orgId),
    productTypesService.list(orgId, { isActive: true }),
    orgSettingsService.getOrCreate(orgId),
  ]);

  // Only show OPEN periods
  const openPeriods = periods.filter((p) => p.status === "OPEN");

  return (
    <div className="space-y-6">
      <DispatchForm
        orgSlug={orgSlug}
        dispatchType={type}
        contacts={JSON.parse(JSON.stringify(contacts))}
        periods={JSON.parse(JSON.stringify(openPeriods))}
        productTypes={JSON.parse(JSON.stringify(productTypes))}
        roundingThreshold={Number(orgSettings.roundingThreshold)}
      />
    </div>
  );
}
