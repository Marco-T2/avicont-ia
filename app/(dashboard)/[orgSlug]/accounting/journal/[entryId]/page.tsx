import { redirect, notFound } from "next/navigation";
import { requireAuth, requireOrgAccess } from "@/features/shared";
import { JournalService } from "@/features/accounting";
import { FiscalPeriodsService } from "@/features/fiscal-periods";
import { VoucherTypesService } from "@/features/voucher-types";
import JournalEntryDetail from "@/components/accounting/journal-entry-detail";

interface EntryDetailPageProps {
  params: Promise<{ orgSlug: string; entryId: string }>;
}

export default async function EntryDetailPage({
  params,
}: EntryDetailPageProps) {
  const { orgSlug, entryId } = await params;

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
      voucherTypeName={voucherType?.name ?? "—"}
    />
  );
}
