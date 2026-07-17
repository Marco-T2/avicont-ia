import { redirect } from "next/navigation";
import { requirePermission } from "@/modules/permissions/application/server";
import {
  makeAccountsService,
  makeJournalsService,
} from "@/modules/accounting/presentation/server";
import { makeFiscalPeriodsService } from "@/modules/fiscal-periods/presentation/server";
import { makeVoucherTypesService } from "@/modules/voucher-types/presentation/server";
import { makeOperationalDocTypeService } from "@/modules/operational-doc-type/presentation/server";
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
  // journal-physical-document Phase 7 — load only active rows. Q3 lock: no
  // direction filter; the dropdown shows all 10 codes regardless of direction.
  const operationalDocTypeService = makeOperationalDocTypeService();

  const [accounts, periods, voucherTypes, operationalDocTypes] = await Promise.all([
    accountsService.list(orgId),
    periodsService.list(orgId).then((entities) => entities.map((p) => p.toSnapshot())),
    voucherTypesService
      .list(orgId)
      .then((entities) => entities.map((vt) => vt.toSnapshot())),
    operationalDocTypeService
      .list(orgId, { isActive: true })
      .then((entities) =>
        entities.map((e) => {
          const s = e.toSnapshot();
          return { id: s.id, code: s.code, name: s.name };
        }),
      ),
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
      contact?: { id: string; name: string; type: string; nit?: string | null } | null;
    }>;
  } | undefined;

  if (duplicateFrom) {
    try {
      const source = await journalsService.getById(orgId, duplicateFrom);
      // Serializo y luego mapeo — JSON.parse(JSON.stringify) descarta cualquier
      // método (toJSON etc.) y deja un objeto plano serializable como props del
      // client component.
      const serialized = JSON.parse(JSON.stringify(source));
      templateEntry = {
        date: source.date.toISOString().slice(0, 10),
        description: source.description ?? "",
        periodId: source.periodId,
        voucherTypeId: source.voucherTypeId,
        lines: serialized.lines.map(
          (l: {
            accountId: string;
            debit: number | string;
            credit: number | string;
            description?: string | null;
            contactId?: string | null;
            contact?: { id: string; name: string; type: string; nit?: string | null } | null;
          }) => ({
            accountId: l.accountId,
            debit: l.debit.toString(),
            credit: l.credit.toString(),
            description: l.description,
            contactId: l.contactId,
            contact: l.contact,
          }),
        ),
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
        operationalDocTypes={operationalDocTypes}
        templateEntry={templateEntry}
      />
    </div>
  );
}
