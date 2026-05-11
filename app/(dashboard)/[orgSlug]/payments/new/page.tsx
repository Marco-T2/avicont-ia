import { redirect } from "next/navigation";
import { requirePermission } from "@/features/permissions/server";
import { makeContactsService } from "@/modules/contacts/presentation/server";
import { makeFiscalPeriodsService } from "@/modules/fiscal-periods/presentation/server";
import { makeOperationalDocTypeService } from "@/modules/operational-doc-type/presentation/server";
import { AccountsRepository } from "@/features/accounting/server";
import { makeOrgSettingsService } from "@/modules/org-settings/presentation/server";
import PaymentForm from "@/components/payments/payment-form";

interface NewPaymentPageProps {
  params: Promise<{ orgSlug: string }>;
  searchParams: Promise<{ type?: string }>;
}

export default async function NewPaymentPage({
  params,
  searchParams,
}: NewPaymentPageProps) {
  const { orgSlug } = await params;
  const { type } = await searchParams;

  let orgId: string;
  try {
    const result = await requirePermission("payments", "write", orgSlug);
    orgId = result.orgId;
  } catch {
    redirect(`/${orgSlug}`);
  }

  const contactsService = makeContactsService();
  const periodsService = makeFiscalPeriodsService();
  const docTypesService = makeOperationalDocTypeService();
  const orgSettingsService = makeOrgSettingsService();
  const accountsRepo = new AccountsRepository();

  const [contacts, periods, docTypes, orgSettings] = await Promise.all([
    contactsService.list(orgId).then((entities) => entities.map((c) => c.toSnapshot())),
    periodsService.list(orgId).then((entities) => entities.map((p) => p.toSnapshot())),
    docTypesService.list(orgId, { isActive: true }).then((entities) => entities.map((d) => d.toSnapshot())),
    orgSettingsService.getOrCreate(orgId).then((s) => s.toSnapshot()),
  ]);

  // Only show OPEN periods
  const openPeriods = periods.filter((p) => p.status === "OPEN");

  // Require type from query param — redirect if missing
  if (type !== "COBRO" && type !== "PAGO") {
    redirect(`/${orgSlug}/payments`);
  }
  const defaultType = type;

  const allEligibleAccounts = await accountsRepo.findDetailChildrenByParentCodes(orgId, [
    orgSettings.cashParentCode,
    orgSettings.pettyCashParentCode,
    orgSettings.bankParentCode,
  ]);

  const cashAccounts = allEligibleAccounts.filter(
    (a) =>
      a.code.startsWith(`${orgSettings.cashParentCode}.`) ||
      a.code.startsWith(`${orgSettings.pettyCashParentCode}.`),
  );
  const bankAccounts = allEligibleAccounts.filter((a) =>
    a.code.startsWith(`${orgSettings.bankParentCode}.`),
  );

  return (
    <div className="space-y-6">
      <PaymentForm
        orgSlug={orgSlug}
        contacts={contacts}
        periods={JSON.parse(JSON.stringify(openPeriods))}
        defaultType={defaultType}
        operationalDocTypes={JSON.parse(JSON.stringify(docTypes))}
        cashAccounts={JSON.parse(JSON.stringify(cashAccounts.map((a) => ({ id: a.id, code: a.code, name: a.name }))))}
        bankAccounts={JSON.parse(JSON.stringify(bankAccounts.map((a) => ({ id: a.id, code: a.code, name: a.name }))))}
        defaultCashCode={orgSettings.cajaGeneralAccountCode}
        defaultBankCode={orgSettings.bancoAccountCode}
      />
    </div>
  );
}
