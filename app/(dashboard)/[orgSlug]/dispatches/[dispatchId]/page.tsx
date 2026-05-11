import { redirect } from "next/navigation";
import { requirePermission } from "@/features/permissions/server";
import { DispatchService } from "@/modules/dispatch/presentation/server";
import { makeContactsService } from "@/modules/contacts/presentation/server";
import type { Contact } from "@/modules/contacts/presentation/index";
import { makeFiscalPeriodsService } from "@/modules/fiscal-periods/presentation/server";
import { makeProductTypeService } from "@/modules/product-type/presentation/server";
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
  const contactsService = makeContactsService();
  const periodsService = makeFiscalPeriodsService();
  const productTypesService = makeProductTypeService();
  const orgSettingsService = makeOrgSettingsService();

  let dispatch;
  try {
    dispatch = await dispatchService.getById(orgId, dispatchId);
  } catch {
    redirect(`/${orgSlug}/dispatches`);
  }

  const [contacts, periods, productTypes, orgSettings] = await Promise.all([
    contactsService.list(orgId, { type: "CLIENTE", isActive: true }).then((entities) => entities.map((c) => c.toSnapshot())),
    periodsService.list(orgId).then((entities) => entities.map((p) => p.toSnapshot())),
    productTypesService.list(orgId, { isActive: true }).then((entities) => entities.map((pt) => pt.toSnapshot())),
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
        contacts={contacts as unknown as Contact[]}
        periods={JSON.parse(JSON.stringify(availablePeriods))}
        productTypes={JSON.parse(JSON.stringify(productTypes))}
        roundingThreshold={Number(orgSettings.roundingThreshold)}
        existingDispatch={JSON.parse(JSON.stringify(dispatch))}
      />
    </div>
  );
}
