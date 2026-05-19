import Decimal from "decimal.js";
import { notFound, redirect } from "next/navigation";
import { requirePermission } from "@/features/permissions/server";
import { makeContactsService } from "@/modules/contacts/presentation/server";
import { makeFiscalPeriodsService } from "@/modules/fiscal-periods/presentation/server";
import { makeOperationalDocTypeService } from "@/modules/operational-doc-type/presentation/server";
import { PrismaAccountsRepo } from "@/modules/accounting/infrastructure/prisma-accounts.repo";
import { makeOrgSettingsService } from "@/modules/org-settings/presentation/server";
import { fetchShortcutSource } from "@/modules/payment/application/helpers/fetch-shortcut-source";
import type { ShortcutInitialValues } from "@/modules/payment/application/types/shortcut-initial-values";
import PaymentForm from "@/components/payments/payment-form";

interface NewPaymentPageProps {
  params: Promise<{ orgSlug: string }>;
  searchParams: Promise<{ type?: string; saleId?: string; purchaseId?: string }>;
}

export default async function NewPaymentPage({
  params,
  searchParams,
}: NewPaymentPageProps) {
  const { orgSlug } = await params;
  const { type, saleId, purchaseId } = await searchParams;

  let orgId: string;
  try {
    const result = await requirePermission("payments", "write", orgSlug);
    orgId = result.orgId;
  } catch {
    redirect(`/${orgSlug}`);
  }

  // ── Shortcut-mode branch ────────────────────────────────────────────────
  // When the URL carries a source id (saleId/purchaseId), call the helper
  // BEFORE the type-gate redirect. The helper enforces XOR + type/id
  // agreement; on `invalid-params` we fall through to the manual flow.
  // Other rejection kinds (not-found / cross-org / voided / fully-paid)
  // are handled in subsequent tasks (T-12..T-15).
  let initialValues: ShortcutInitialValues | undefined;
  if (saleId || purchaseId) {
    if (type === "COBRO" || type === "PAGO") {
      const shortcut = await fetchShortcutSource({
        orgId,
        type,
        saleId,
        purchaseId,
      });
      if (shortcut.kind === "not-found") {
        // Source comprobante does not exist — render the framework's 404.
        notFound();
      }
      if (shortcut.kind === "cross-org") {
        // Helper already blocked the read. Redirect to the org's payments
        // list — same target the manual type-gate uses.
        redirect(`/${orgSlug}/payments`);
      }
      if (shortcut.kind === "voided" || shortcut.kind === "fully-paid") {
        // Source rejection that points back to the comprobante:
        // - voided     : comprobante is VOIDED, nothing to pay against
        // - fully-paid : balance is 0, allocation would be a no-op
        // Querystring lets the target page surface a disambiguated toast
        // in a later phase (B1 stays silent).
        const target =
          type === "COBRO"
            ? `/${orgSlug}/sales/${saleId}`
            : `/${orgSlug}/purchases/${purchaseId}`;
        redirect(`${target}?error=${shortcut.kind}`);
      }
      if (shortcut.kind === "ok") {
        // DEC-1 boundary: coerce decimal balance to JS number ONCE here
        // (HALF_UP @ 2dp). Client Components never receive a Decimal.
        const balance = shortcut.source.balance
          .toDecimalPlaces(2, Decimal.ROUND_HALF_UP)
          .toNumber();
        initialValues = {
          type,
          contactId: shortcut.source.contactId,
          description: shortcut.source.defaultDescription,
          sourceKind: shortcut.source.kind,
          sourceId: shortcut.source.id,
          voucherCode: shortcut.source.voucherCode,
          referenceNumber: shortcut.source.referenceNumber,
          allocationTargetId: shortcut.source.allocationTargetId,
          allocationBalance: balance,
        };
      }
      // `invalid-params` falls through to the manual form.
      // T-12..T-15 will add not-found / cross-org / voided / fully-paid.
    }
  }

  const contactsService = makeContactsService();
  const periodsService = makeFiscalPeriodsService();
  const docTypesService = makeOperationalDocTypeService();
  const orgSettingsService = makeOrgSettingsService();
  const accountsRepo = new PrismaAccountsRepo();

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
        initialValues={initialValues}
      />
    </div>
  );
}
