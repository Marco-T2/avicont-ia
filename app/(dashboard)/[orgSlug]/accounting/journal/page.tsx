import { redirect } from "next/navigation";
import { requirePermission } from "@/features/permissions/server";
import { makeJournalsService } from "@/modules/accounting/presentation/server";
import { makeFiscalPeriodsService } from "@/modules/fiscal-periods/presentation/server";
import { makeAnnualCloseService } from "@/modules/annual-close/presentation/server";
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
  const annualCloseService = makeAnnualCloseService();
  const voucherTypesService = makeVoucherTypesService();

  const pagination = paginationQuerySchema.parse({
    page: sp.page,
    pageSize: sp.pageSize,
  });

  const [periods, voucherTypes] = await Promise.all([
    periodsService.list(orgId).then((entities) => entities.map((p) => p.toSnapshot())),
    voucherTypesService
      .list(orgId)
      .then((entities) => entities.map((vt) => vt.toSnapshot())),
  ]);

  // ── Derive Gestión (fiscal year) state ───────────────────────────────────
  // Distinct years from existing periods, DESC. Empty org → fallback to the
  // current calendar year so the dropdown stays renderable (no crash).
  const uniqueYears = Array.from(new Set(periods.map((p) => p.year))).sort(
    (a, b) => b - a,
  );
  const currentYear = new Date().getFullYear();
  const availableYears = uniqueYears.length > 0 ? uniqueYears : [currentYear];

  // Default gestión = the FiscalYear with status='OPEN' (year DESC tiebreaker),
  // else the most recent year with periods. N lookups (≤ ~10 historical years)
  // — same pattern as settings/periods/page.tsx:65.
  const fiscalYearStatuses = await Promise.all(
    uniqueYears.map((y) =>
      annualCloseService.getFiscalYearByYear(orgId, y).catch(() => null),
    ),
  );
  const openYear = uniqueYears.find(
    (_, i) => fiscalYearStatuses[i]?.status === "OPEN",
  );
  const defaultYear = openYear ?? availableYears[0];

  // URL `?year=` wins when valid; else fall back to default. Same defense for
  // `periodId`: drop it if it belongs to a different year (URL incoherence).
  const requestedYear =
    typeof sp.year === "string" ? Number(sp.year) : undefined;
  const selectedYear =
    requestedYear && availableYears.includes(requestedYear)
      ? requestedYear
      : defaultYear;

  const periodIdParam =
    typeof sp.periodId === "string" ? sp.periodId : undefined;
  const periodMatches = periodIdParam
    ? periods.find((p) => p.id === periodIdParam)
    : undefined;
  const periodId =
    periodMatches && periodMatches.year === selectedYear
      ? periodIdParam
      : undefined;

  const filters: Record<string, unknown> = { year: selectedYear };
  if (periodId) {
    filters.periodId = periodId;
  }
  if (sp.voucherTypeId && typeof sp.voucherTypeId === "string") {
    filters.voucherTypeId = sp.voucherTypeId;
  }
  if (sp.status && typeof sp.status === "string") {
    filters.status = sp.status;
  }

  const paginatedEntries = await journalService.listPaginated(
    orgId,
    filters,
    pagination,
  );

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
        availableYears={availableYears}
        selectedYear={selectedYear}
        voucherTypes={JSON.parse(JSON.stringify(voucherTypes))}
        filters={{
          periodId,
          voucherTypeId:
            typeof sp.voucherTypeId === "string" ? sp.voucherTypeId : undefined,
          status: typeof sp.status === "string" ? sp.status : undefined,
        }}
        highlightId={typeof sp.highlightId === "string" ? sp.highlightId : undefined}
        canWrite={canWrite}
      />
    </div>
  );
}
