import { redirect, notFound } from "next/navigation";
import { requirePermission } from "@/features/shared/permissions.server";
import { JournalService } from "@/features/accounting";
import { FiscalPeriodsService } from "@/features/fiscal-periods/server";
import { VoucherTypesService } from "@/features/voucher-types/server";
import JournalEntryDetail from "@/components/accounting/journal-entry-detail";

interface EntryDetailPageProps {
  params: Promise<{ orgSlug: string; entryId: string }>;
}

export default async function EntryDetailPage({
  params,
}: EntryDetailPageProps) {
  const { orgSlug, entryId } = await params;

  let orgId: string;
  try {
    const result = await requirePermission("journal", "read", orgSlug);
    orgId = result.orgId;
  } catch {
    redirect(`/${orgSlug}`);
  }

  const journalService = new JournalService();
  const periodsService = new FiscalPeriodsService();
  const voucherTypesService = new VoucherTypesService();

  let entry;
  try {
    entry = await journalService.getById(orgId, entryId);
  } catch {
    notFound();
  }

  const [periods, voucherTypes] = await Promise.all([
    periodsService.list(orgId),
    voucherTypesService.list(orgId),
  ]);

  const period = periods.find((p) => p.id === entry.periodId);
  const voucherType = voucherTypes.find((vt) => vt.id === entry.voucherTypeId);

  return (
    <JournalEntryDetail
      orgSlug={orgSlug}
      entry={JSON.parse(JSON.stringify(entry))}
      periodName={period?.name ?? "—"}
      periodStatus={period?.status ?? "CLOSED"}
      voucherTypeName={voucherType?.name ?? "—"}
      voucherTypeActive={voucherType?.isActive ?? true}
    />
  );
}
