import { redirect } from "next/navigation";
import { requirePermission } from "@/features/permissions/server";
import {
  makeAccountsService,
  makeJournalsService,
} from "@/modules/accounting/presentation/server";
import { makeFiscalPeriodsService } from "@/modules/fiscal-periods/presentation/server";
import { makeVoucherTypesService } from "@/modules/voucher-types/presentation/server";
import JournalEntryForm from "@/components/accounting/journal-entry-form";

interface NewJournalEntryPageProps {
  params: Promise<{ orgSlug: string }>;
  searchParams: Promise<{ duplicateFrom?: string }>;
}

export default async function NewJournalEntryPage({
  params,
  searchParams,
}: NewJournalEntryPageProps) {
  const { orgSlug } = await params;
  const { duplicateFrom } = await searchParams;

  let orgId: string;
  try {
    const result = await requirePermission("journal", "write", orgSlug);
    orgId = result.orgId;
  } catch {
    redirect(`/${orgSlug}`);
  }

  const accountsService = makeAccountsService();
  const periodsService = makeFiscalPeriodsService();
  const voucherTypesService = makeVoucherTypesService();
  const journalsService = makeJournalsService();

  const [accounts, periods, voucherTypes] = await Promise.all([
    accountsService.list(orgId),
    periodsService.list(orgId).then((entities) => entities.map((p) => p.toSnapshot())),
    voucherTypesService
      .list(orgId)
      .then((entities) => entities.map((vt) => vt.toSnapshot())),
  ]);

  // Si llega `?duplicateFrom={entryId}`, traemos el entry para pre-llenar el form
  // como template (POST nuevo, voucher type editable, sin referenceNumber).
  let templateEntry: {
    date: string;
    description: string;
    periodId: string;
    voucherTypeId: string;
    lines: Array<{
      accountId: string;
      debit: number | string;
      credit: number | string;
      description?: string | null;
      contactId?: string | null;
    }>;
  } | undefined;

  if (duplicateFrom) {
    try {
      const source = await journalsService.getById(orgId, duplicateFrom);
      templateEntry = {
        // Input HTML type=date espera YYYY-MM-DD; el form lo usa así.
        date: source.date.toISOString().slice(0, 10),
        description: source.description ?? "",
        periodId: source.periodId,
        voucherTypeId: source.voucherTypeId,
        lines: source.lines.map((l) => ({
          accountId: l.accountId,
          debit: l.debit.toString(),
          credit: l.credit.toString(),
          description: l.description,
          contactId: l.contactId,
        })),
      };
    } catch {
      // Si el ID no existe en la org, ignoramos silenciosamente y mostramos
      // el form vacío — comportamiento equivalente a navegar a /new directo.
    }
  }

  return (
    <div className="space-y-6">
      <JournalEntryForm
        orgSlug={orgSlug}
        accounts={JSON.parse(JSON.stringify(accounts))}
        periods={JSON.parse(JSON.stringify(periods))}
        voucherTypes={JSON.parse(JSON.stringify(voucherTypes))}
        templateEntry={templateEntry}
      />
    </div>
  );
}
