import { redirect, notFound } from "next/navigation";
import { requirePermission } from "@/features/permissions/server";
import { PaymentService } from "@/modules/payment/presentation/server";
import { makeContactsService } from "@/modules/contacts/presentation/server";
import { makeFiscalPeriodsService } from "@/modules/fiscal-periods/presentation/server";
import { OperationalDocTypesService } from "@/features/operational-doc-types/server";
import { AccountsRepository } from "@/features/accounting/server";
import { makeOrgSettingsService } from "@/modules/org-settings/presentation/server";
import PaymentForm from "@/components/payments/payment-form";

interface PaymentDetailPageProps {
  params: Promise<{ orgSlug: string; paymentId: string }>;
}

export default async function PaymentDetailPage({
  params,
}: PaymentDetailPageProps) {
  const { orgSlug, paymentId } = await params;

  let orgId: string;
  try {
    const result = await requirePermission("payments", "write", orgSlug);
    orgId = result.orgId;
  } catch {
    redirect(`/${orgSlug}`);
  }

  const paymentService = new PaymentService();
  const contactsService = makeContactsService();
  const periodsService = makeFiscalPeriodsService();
  const docTypesService = new OperationalDocTypesService();
  const orgSettingsService = makeOrgSettingsService();
  const accountsRepo = new AccountsRepository();

  let payment;
  try {
    payment = await paymentService.getById(orgId, paymentId);
  } catch {
    notFound();
  }

  const [contacts, periods, docTypes, orgSettings] = await Promise.all([
    contactsService.list(orgId),
    periodsService.list(orgId).then((entities) => entities.map((p) => p.toSnapshot())),
    docTypesService.list(orgId, { isActive: true }),
    orgSettingsService.getOrCreate(orgId).then((s) => s.toSnapshot()),
  ]);

  const openPeriods = periods.filter((p) => p.status === "OPEN");

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
        contacts={JSON.parse(JSON.stringify(contacts))}
        periods={JSON.parse(JSON.stringify(openPeriods))}
        existingPayment={JSON.parse(JSON.stringify(payment))}
        operationalDocTypes={JSON.parse(JSON.stringify(docTypes))}
        cashAccounts={JSON.parse(JSON.stringify(cashAccounts.map((a) => ({ id: a.id, code: a.code, name: a.name }))))}
        bankAccounts={JSON.parse(JSON.stringify(bankAccounts.map((a) => ({ id: a.id, code: a.code, name: a.name }))))}
        defaultCashCode={orgSettings.cajaGeneralAccountCode}
        defaultBankCode={orgSettings.bancoAccountCode}
      />
    </div>
  );
}
