import "server-only";
import { ForbiddenError, NotFoundError, ValidationError } from "@/features/shared/errors";
import type { Role } from "@/features/shared/permissions";
import { WorksheetRepository } from "./worksheet.repository";
import { buildWorksheet } from "./worksheet.builder";
import type { WorksheetFilters, WorksheetReport } from "./worksheet.types";

// ── RBAC ──────────────────────────────────────────────────────────────────────

/** Roles authorized to access the worksheet (same set as FS service). */
const ALLOWED_ROLES: Role[] = ["owner", "admin", "contador"];

function assertWorksheetAccess(role: Role): void {
  if (!ALLOWED_ROLES.includes(role)) {
    throw new ForbiddenError(
      "Solo los roles owner, admin y contador pueden acceder a la Hoja de Trabajo",
      "FORBIDDEN",
    );
  }
}

// ── Service ───────────────────────────────────────────────────────────────────

/**
 * WorksheetService — orchestrates RBAC, filter resolution, repository calls,
 * and the pure builder to produce a WorksheetReport.
 *
 * Does NOT import Prisma. All DB access goes through WorksheetRepository.
 */
export class WorksheetService {
  private readonly repo: WorksheetRepository;

  constructor(repo?: WorksheetRepository) {
    this.repo = repo ?? new WorksheetRepository();
  }

  /**
   * Generate a 12-column Worksheet report.
   *
   * - RBAC gate (REQ-11): rejects if role not in ALLOWED_ROLES
   * - Filter resolution (REQ-10): date range + optional fiscalPeriodId intersection
   * - Dual aggregation via Promise.all: sumas (isAdjustment=false) + ajustes (isAdjustment=true)
   * - Pure builder: no DB access after the two aggregations
   */
  async generateWorksheet(
    orgId: string,
    role: Role,
    filters: WorksheetFilters,
  ): Promise<WorksheetReport> {
    // 1. Gate RBAC (REQ-11) — before ANY DB query
    assertWorksheetAccess(role);

    // 2. Validate date range order (REQ-10.E2)
    const { dateFrom, dateTo, fiscalPeriodId } = filters;

    if (dateFrom > dateTo) {
      throw new ValidationError(
        "dateFrom no puede ser posterior a dateTo",
      );
    }

    // 3. Resolve effective range (REQ-10)
    let effectiveFrom = dateFrom;
    let effectiveTo = dateTo;

    if (fiscalPeriodId) {
      const period = await this.repo.findFiscalPeriod(orgId, fiscalPeriodId);
      if (!period) {
        throw new NotFoundError("Período fiscal");
      }

      // Intersection: MAX(dateFrom, period.startDate) → MIN(dateTo, period.endDate)
      effectiveFrom = dateFrom > period.startDate ? dateFrom : period.startDate;
      effectiveTo   = dateTo < period.endDate ? dateTo : period.endDate;

      // If date range falls outside the fiscal period, effective range may be empty
      // (effectiveFrom > effectiveTo). This returns an empty report per REQ-10.S4.
    }

    const range = { dateFrom: effectiveFrom, dateTo: effectiveTo };

    // 4. Parallel data load: accounts + both aggregation buckets
    const [accounts, [sumas, ajustes]] = await Promise.all([
      this.repo.findAccountsWithDetail(orgId),
      Promise.all([
        this.repo.aggregateByAdjustmentFlag(orgId, range, false), // Sumas
        this.repo.aggregateByAdjustmentFlag(orgId, range, true),  // Ajustes
      ]),
    ]);

    // 5. Build report (pure function — no DB access)
    const report = buildWorksheet({
      accounts,
      sumas,
      ajustes,
      dateFrom: effectiveFrom,
      dateTo: effectiveTo,
    });

    // 6. Inject orgId (builder leaves it blank — service knows the real orgId)
    return { ...report, orgId };
  }
}
