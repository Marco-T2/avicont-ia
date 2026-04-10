import { redirect, notFound } from "next/navigation";
import { requireAuth, requireOrgAccess } from "@/features/shared";
import { PaymentService } from "@/features/payment";
import { ContactsService } from "@/features/contacts";
import { FiscalPeriodsService } from "@/features/fiscal-periods";
import { OperationalDocTypesService } from "@/features/operational-doc-types";
import { AccountsRepository } from "@/features/accounting";
import { OrgSettingsService } from "@/features/org-settings";
import PaymentForm from "@/components/payments/payment-form";

interface PaymentDetailPageProps {
  params: Promise<{ orgSlug: string; paymentId: string }>;
}

export default async function PaymentDetailPage({
  params,
}: PaymentDetailPageProps) {
  const { orgSlug, paymentId } = await params;

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

  const paymentService = new PaymentService();
  const contactsService = new ContactsService();
  const periodsService = new FiscalPeriodsService();
  const docTypesService = new OperationalDocTypesService();
  const orgSettingsService = new OrgSettingsService();
  const accountsRepo = new AccountsRepository();

  let payment;
  try {
    payment = await paymentService.getById(orgId, paymentId);
  } catch {
    notFound();
  }

  const [contacts, periods, docTypes, orgSettings] = await Promise.all([
    contactsService.list(orgId),
    periodsService.list(orgId),
    docTypesService.list(orgId, { isActive: true }),
    orgSettingsService.getOrCreate(orgId),
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
