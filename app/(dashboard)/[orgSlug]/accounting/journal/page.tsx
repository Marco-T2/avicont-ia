import { redirect } from "next/navigation";
import { requirePermission } from "@/features/permissions/server";
import { makeJournalsService } from "@/modules/accounting/presentation/server";
import { makeFiscalPeriodsService } from "@/modules/fiscal-periods/presentation/server";
import { makeVoucherTypesService } from "@/modules/voucher-types/presentation/server";
import { paginationQuerySchema } from "@/modules/shared/presentation/pagination.schema";
import JournalEntryList from "@/components/accounting/journal-entry-list";

interface JournalPageProps {
  params: Promise<{ orgSlug: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function JournalPage({
  params,
  searchParams,
}: JournalPageProps) {
  const { orgSlug } = await params;
  const sp = await searchParams;

  let orgId: string;
  try {
    const result = await requirePermission("journal", "read", orgSlug);
    orgId = result.orgId;
  } catch {
    redirect(`/${orgSlug}`);
  }

  // Check separado para journal:write — controla la visibilidad del botón
  // "+ Crear Asiento con IA". Los roles sin permiso no lo ven; el RBAC del
  // backend cierra el hueco igualmente (defensa en profundidad).
  let canWrite = false;
  try {
    await requirePermission("journal", "write", orgSlug);
    canWrite = true;
  } catch {
    canWrite = false;
  }

  const journalService = makeJournalsService();
  const periodsService = makeFiscalPeriodsService();
  const voucherTypesService = makeVoucherTypesService();

  const pagination = paginationQuerySchema.parse({
    page: sp.page,
    pageSize: sp.pageSize,
  });

  const filters: Record<string, unknown> = {};
  if (sp.periodId && typeof sp.periodId === "string") {
    filters.periodId = sp.periodId;
  }
  if (sp.voucherTypeId && typeof sp.voucherTypeId === "string") {
    filters.voucherTypeId = sp.voucherTypeId;
  }
  if (sp.status && typeof sp.status === "string") {
    filters.status = sp.status;
  }
  if (
    sp.origin &&
    typeof sp.origin === "string" &&
    (sp.origin === "manual" || sp.origin === "auto")
  ) {
    filters.origin = sp.origin;
  }

  const [paginatedEntries, periods, voucherTypes] = await Promise.all([
    journalService.listPaginated(orgId, filters, pagination),
    periodsService.list(orgId).then((entities) => entities.map((p) => p.toSnapshot())),
    voucherTypesService
      .list(orgId)
      .then((entities) => entities.map((vt) => vt.toSnapshot())),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Libro Diario</h1>
        <p className="text-muted-foreground mt-1">Registro de asientos contables</p>
      </div>

      <JournalEntryList
        orgSlug={orgSlug}
        items={JSON.parse(JSON.stringify(paginatedEntries.items))}
        total={paginatedEntries.total}
        page={paginatedEntries.page}
        pageSize={paginatedEntries.pageSize}
        totalPages={paginatedEntries.totalPages}
        periods={JSON.parse(JSON.stringify(periods))}
        voucherTypes={JSON.parse(JSON.stringify(voucherTypes))}
        filters={{
          periodId: typeof sp.periodId === "string" ? sp.periodId : undefined,
          voucherTypeId:
            typeof sp.voucherTypeId === "string" ? sp.voucherTypeId : undefined,
          status: typeof sp.status === "string" ? sp.status : undefined,
          origin:
            sp.origin === "manual" || sp.origin === "auto"
              ? (sp.origin as "manual" | "auto")
              : undefined,
        }}
        highlightId={typeof sp.highlightId === "string" ? sp.highlightId : undefined}
        canWrite={canWrite}
      />
    </div>
  );
}
