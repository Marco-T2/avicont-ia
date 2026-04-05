import { redirect } from "next/navigation";
import { requireAuth, requireOrgAccess } from "@/features/shared";
import { AccountsService } from "@/features/accounting";
import { FiscalPeriodsService } from "@/features/fiscal-periods";
import { VoucherTypesService } from "@/features/voucher-types";
import JournalEntryForm from "@/components/accounting/journal-entry-form";

interface NewJournalEntryPageProps {
  params: Promise<{ orgSlug: string }>;
}

export default async function NewJournalEntryPage({
  params,
}: NewJournalEntryPageProps) {
  const { orgSlug } = await params;

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

  const accountsService = new AccountsService();
  const periodsService = new FiscalPeriodsService();
  const voucherTypesService = new VoucherTypesService();

  const [accounts, periods, voucherTypes] = await Promise.all([
    accountsService.list(orgId),
    periodsService.list(orgId),
    voucherTypesService.list(orgId),
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
