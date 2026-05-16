import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requirePermission } from "@/features/permissions/server";
import { makeFiscalPeriodsService } from "@/modules/fiscal-periods/presentation/server";
import { makeAnnualCloseService } from "@/modules/annual-close/presentation/server";
import { Button } from "@/components/ui/button";
import AnnualPeriodList, {
  type PeriodsByYear,
  type YearGroup,
} from "@/components/accounting/annual-period-list";
import NewGestionButton from "@/components/accounting/new-gestion-button";
import type { FiscalPeriod } from "@/modules/fiscal-periods/presentation/index";

interface PeriodsPageProps {
  params: Promise<{ orgSlug: string }>;
}

/**
 * Periods page — year-grouped accordion (Phase 7.5 GREEN).
 *
 * Server-side data shape (R5 NO Prisma leak — snapshot-only DTOs):
 *  1. Fetch all FiscalPeriod snapshots for the org.
 *  2. Group by year (newest first).
 *  3. For each year:
 *     - call AnnualCloseService.getSummary(orgId, year) → balance + gate state
 *     - call AnnualCloseService.getFiscalYearByYear(orgId, year) → closedAt etc.
 *  4. Pass periodsByYear[] to AnnualPeriodList (client component).
 *
 * RBAC: requirePermission('period','read', orgSlug) preserved.
 *
 * Citation: design rev 2 section 8 + spec REQ-7.1.
 */
export default async function PeriodsPage({ params }: PeriodsPageProps) {
  const { orgSlug } = await params;

  let orgId: string;
  try {
    const result = await requirePermission("period", "read", orgSlug);
    orgId = result.orgId;
  } catch {
    redirect(`/${orgSlug}`);
  }

  const fiscalPeriodsService = makeFiscalPeriodsService();
  const annualCloseService = makeAnnualCloseService();

  const periods: FiscalPeriod[] = (
    await fiscalPeriodsService.list(orgId)
  ).map((p) => p.toSnapshot());

  // Group periods by year, then build YearGroup[] sorted newest-first.
  const periodsByYearMap = new Map<number, FiscalPeriod[]>();
  for (const p of periods) {
    const arr = periodsByYearMap.get(p.year) ?? [];
    arr.push(p);
    periodsByYearMap.set(p.year, arr);
  }

  const years = Array.from(periodsByYearMap.keys()).sort((a, b) => b - a);

  const periodsByYear: PeriodsByYear = await Promise.all(
    years.map<Promise<YearGroup>>(async (year) => {
      const yearPeriods = periodsByYearMap.get(year) ?? [];
      const [summary, fiscalYear] = await Promise.all([
        annualCloseService.getSummary(orgId, year).catch(() => null),
        annualCloseService.getFiscalYearByYear(orgId, year).catch(() => null),
      ]);

      return {
        year,
        periods: yearPeriods.sort((a, b) => a.month - b.month),
        fiscalYear: fiscalYear
          ? {
              id: fiscalYear.id,
              status: fiscalYear.status,
              closedAt: fiscalYear.closedAt,
            }
          : null,
        summary,
      };
    }),
  );

  const isEmpty = periodsByYear.length === 0;

  return (
    <div className="space-y-6">
      <Link href={`/${orgSlug}/settings`}>
        <Button variant="ghost" size="sm">
          <ArrowLeft className="h-4 w-4 mr-1" />
          Volver a Configuración
        </Button>
      </Link>

      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Períodos Fiscales</h1>
          <p className="text-muted-foreground mt-1">
            Gestión de períodos contables de la organización
          </p>
        </div>
        {!isEmpty && <NewGestionButton orgSlug={orgSlug} />}
      </div>

      <AnnualPeriodList
        orgSlug={orgSlug}
        periodsByYear={JSON.parse(JSON.stringify(periodsByYear))}
      />
    </div>
  );
}
