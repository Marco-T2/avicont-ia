import { redirect } from "next/navigation";
import { requireAuth, requireOrgAccess } from "@/features/shared";
import { DispatchService } from "@/features/dispatch";
import { ContactsService } from "@/features/contacts";
import { FiscalPeriodsService } from "@/features/fiscal-periods";
import { ProductTypesService } from "@/features/product-types";
import { OrgSettingsService } from "@/features/org-settings";
import DispatchForm from "@/components/dispatches/dispatch-form";

interface DispatchDetailPageProps {
  params: Promise<{ orgSlug: string; dispatchId: string }>;
}

export default async function DispatchDetailPage({
  params,
}: DispatchDetailPageProps) {
  const { orgSlug, dispatchId } = await params;

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

  const dispatchService = new DispatchService();
  const contactsService = new ContactsService();
  const periodsService = new FiscalPeriodsService();
  const productTypesService = new ProductTypesService();
  const orgSettingsService = new OrgSettingsService();

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
    orgSettingsService.getOrCreate(orgId),
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
