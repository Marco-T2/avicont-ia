import { redirect } from "next/navigation";
import { requirePermission } from "@/features/permissions/server";
import { DispatchService } from "@/features/dispatch/server";
import { ContactsService } from "@/features/contacts/server";
import { FiscalPeriodsService } from "@/features/fiscal-periods/server";
import { ProductTypesService } from "@/features/product-types/server";
import { makeOrgSettingsService } from "@/modules/org-settings/presentation/server";
import DispatchForm from "@/components/dispatches/dispatch-form";

interface DispatchDetailPageProps {
  params: Promise<{ orgSlug: string; dispatchId: string }>;
}

export default async function DispatchDetailPage({
  params,
}: DispatchDetailPageProps) {
  const { orgSlug, dispatchId } = await params;

  let orgId: string;
  try {
    const result = await requirePermission("sales", "write", orgSlug);
    orgId = result.orgId;
  } catch {
    redirect(`/${orgSlug}`);
  }

  const dispatchService = new DispatchService();
  const contactsService = new ContactsService();
  const periodsService = new FiscalPeriodsService();
  const productTypesService = new ProductTypesService();
  const orgSettingsService = makeOrgSettingsService();

  let dispatch;
  try {
    dispatch = await dispatchService.getById(orgId, dispatchId);
  } catch {
    redirect(`/${orgSlug}/dispatches`);
  }

  const [contacts, periods, productTypes, orgSettings] = await Promise.all([
    contactsService.list(orgId, { type: "CLIENTE", isActive: true }),
    periodsService.list(orgId),
    productTypesService.list(orgId, { isActive: true }),
    orgSettingsService.getOrCreate(orgId).then((s) => s.toSnapshot()),
  ]);

  // Open periods for editing; ensure current dispatch period is included even if closed
  const openPeriods = periods.filter((p) => p.status === "OPEN");
  const dispatchPeriodIncluded = openPeriods.some(
    (p) => p.id === dispatch.periodId,
  );
  const availablePeriods = dispatchPeriodIncluded
    ? openPeriods
    : [
        ...openPeriods,
        ...periods.filter((p) => p.id === dispatch.periodId),
      ];

  return (
    <div className="space-y-6">
      <DispatchForm
        orgSlug={orgSlug}
        dispatchType={dispatch.dispatchType as "NOTA_DESPACHO" | "BOLETA_CERRADA"}
        contacts={JSON.parse(JSON.stringify(contacts))}
        periods={JSON.parse(JSON.stringify(availablePeriods))}
        productTypes={JSON.parse(JSON.stringify(productTypes))}
        roundingThreshold={Number(orgSettings.roundingThreshold)}
        existingDispatch={JSON.parse(JSON.stringify(dispatch))}
      />
    </div>
  );
}
