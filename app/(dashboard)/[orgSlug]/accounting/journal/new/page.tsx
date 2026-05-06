import { redirect } from "next/navigation";
import { requirePermission } from "@/features/permissions/server";
import { AccountsService } from "@/features/accounting/server";
import { makeFiscalPeriodsService } from "@/modules/fiscal-periods/presentation/server";
import { makeVoucherTypesService } from "@/modules/voucher-types/presentation/server";
import JournalEntryForm from "@/components/accounting/journal-entry-form";

interface NewJournalEntryPageProps {
  params: Promise<{ orgSlug: string }>;
}

export default async function NewJournalEntryPage({
  params,
}: NewJournalEntryPageProps) {
  const { orgSlug } = await params;

  let orgId: string;
  try {
    const result = await requirePermission("journal", "write", orgSlug);
    orgId = result.orgId;
  } catch {
    redirect(`/${orgSlug}`);
  }

  const accountsService = new AccountsService();
  const periodsService = makeFiscalPeriodsService();
  const voucherTypesService = makeVoucherTypesService();

  const [accounts, periods, voucherTypes] = await Promise.all([
    accountsService.list(orgId),
    periodsService.list(orgId).then((entities) => entities.map((p) => p.toSnapshot())),
    voucherTypesService
      .list(orgId)
      .then((entities) => entities.map((vt) => vt.toSnapshot())),
  ]);

  return (
    <div className="space-y-6">
      <JournalEntryForm
        orgSlug={orgSlug}
        accounts={JSON.parse(JSON.stringify(accounts))}
        periods={JSON.parse(JSON.stringify(periods))}
        voucherTypes={JSON.parse(JSON.stringify(voucherTypes))}
      />
    </div>
  );
}
