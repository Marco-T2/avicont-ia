import { redirect } from "next/navigation";
import { requirePermission } from "@/features/permissions/server";
import { makeContactsService } from "@/modules/contacts/presentation/server";
import { makeFiscalPeriodsService } from "@/modules/fiscal-periods/presentation/server";
import { ProductTypesService } from "@/features/product-types/server";
import { makeOrgSettingsService } from "@/modules/org-settings/presentation/server";
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

  const contactsService = makeContactsService();
  const periodsService = makeFiscalPeriodsService();
  const productTypesService = new ProductTypesService();
  const orgSettingsService = makeOrgSettingsService();

  const [contacts, periods, productTypes, orgSettings] = await Promise.all([
    contactsService.list(orgId, { type: "CLIENTE", isActive: true }),
    periodsService.list(orgId).then((entities) => entities.map((p) => p.toSnapshot())),
    productTypesService.list(orgId, { isActive: true }),
    orgSettingsService.getOrCreate(orgId).then((s) => s.toSnapshot()),
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
