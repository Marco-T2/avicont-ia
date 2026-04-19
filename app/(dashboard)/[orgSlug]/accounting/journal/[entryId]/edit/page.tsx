import { redirect, notFound } from "next/navigation";
import { requirePermission } from "@/features/shared/permissions.server";
import { JournalService, AccountsService } from "@/features/accounting";
import { FiscalPeriodsService } from "@/features/fiscal-periods/server";
import { VoucherTypesService } from "@/features/voucher-types";
import JournalEntryForm from "@/components/accounting/journal-entry-form";

interface EditJournalEntryPageProps {
  params: Promise<{ orgSlug: string; entryId: string }>;
}

export default async function EditJournalEntryPage({
  params,
}: EditJournalEntryPageProps) {
  const { orgSlug, entryId } = await params;

  let orgId: string;
  try {
    const result = await requirePermission("journal", "write", orgSlug);
    orgId = result.orgId;
  } catch {
    redirect(`/${orgSlug}`);
  }

  const journalService = new JournalService();
  const accountsService = new AccountsService();
  const periodsService = new FiscalPeriodsService();
  const voucherTypesService = new VoucherTypesService();

  let entry;
  try {
    entry = await journalService.getById(orgId, entryId);
  } catch {
    notFound();
  }

  // REQ-A.1 (amended PR7): DRAFT and POSTED manual entries are candidates for editing,
  // BUT only while their period is OPEN. Auto-generated and VOIDED redirect to detail.
  const isManualEditable =
    entry.status === "DRAFT" ||
    (entry.status === "POSTED" && entry.sourceType === null);

  if (!isManualEditable) {
    redirect(`/${orgSlug}/accounting/journal/${entryId}`);
  }

  const [accounts, periods, voucherTypes] = await Promise.all([
    accountsService.list(orgId),
    periodsService.list(orgId),
    voucherTypesService.list(orgId),
  ]);

  // Period-gate: closed periods make entries immutable (same rule as sales/purchases).
  const period = periods.find((p) => p.id === entry.periodId);
  if (!period || period.status !== "OPEN") {
    notFound();
  }

  const serializedEntry = JSON.parse(JSON.stringify(entry));

  return (
    <div className="space-y-6">
      <JournalEntryForm
        orgSlug={orgSlug}
        accounts={JSON.parse(JSON.stringify(accounts))}
        periods={JSON.parse(JSON.stringify(periods))}
        voucherTypes={JSON.parse(JSON.stringify(voucherTypes))}
        editEntry={{
          id: serializedEntry.id,
          number: serializedEntry.number,
          date: serializedEntry.date.split("T")[0],
          description: serializedEntry.description,
          periodId: serializedEntry.periodId,
          voucherTypeId: serializedEntry.voucherTypeId,
          referenceNumber: serializedEntry.referenceNumber,
          lines: serializedEntry.lines,
        }}
      />
    </div>
  );
}
