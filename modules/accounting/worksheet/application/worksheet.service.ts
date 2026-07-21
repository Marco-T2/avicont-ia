import { ForbiddenError, NotFoundError, ValidationError } from "@/modules/shared/domain/errors";
import { PERMISSIONS_READ, type Role } from "@/modules/permissions/domain/permissions";
import type { WorksheetQueryPort } from "../domain/ports/worksheet-query.port";
import type { WorksheetExporterPort } from "../domain/ports/worksheet-exporter.port";
import { buildWorksheet } from "../domain/worksheet.builder";
import type { WorksheetFilters, WorksheetReport } from "../domain/worksheet.types";

// ── RBAC ──────────────────────────────────────────────────────────────────────

/**
 * Roles authorized to access the worksheet (same set as FS service).
 * Source of truth: PERMISSIONS_READ["financial-statements"] en el dominio.
 */
const ALLOWED_ROLES: readonly Role[] = PERMISSIONS_READ["financial-statements"];

function assertWorksheetAccess(role: Role): void {
  if (!ALLOWED_ROLES.includes(role)) {
    throw new ForbiddenError(
      "Solo los roles owner, admin y contador pueden acceder a la Hoja de Trabajo",
      "FORBIDDEN",
    );
  }
}

// ── Deps ──────────────────────────────────────────────────────────────────────

/**
 * Dependency injection contract for WorksheetService.
 *
 * Single-port architecture (WS-D2): only WorksheetQueryPort.
 * No secondary port — worksheet is self-contained (no cross-module data deps
 * like IncomeStatementSourcePort in the equity-statement sub-POC).
 */
interface WorksheetServiceDeps {
  repo: WorksheetQueryPort;
  /** [EXPORT] cluster paydown — injected exporter port (generalizes the
   *  pattern financial-statements.service.ts already used). */
  exporter: WorksheetExporterPort;
}

// ── Service ───────────────────────────────────────────────────────────────────

/**
 * WorksheetService — RBAC gate + orchestration.
 *
 * Deps-object ctor per [[API_breaking_change_C1_blocks_C4_test_migration]].
 * NO server-only directive — application layer is pure orchestration.
 * Server-only boundary lives in presentation/server.ts (REQ-002).
 *
 * Does NOT import Prisma directly. All DB access goes through WorksheetQueryPort.
 * Method name `generateWorksheet` preserved from features/ original — NOT renamed
 * to `generate()`. Axis-distinct from TrialBalanceService (WS-D2, spec α89 lock).
 */
export class WorksheetService {
  private readonly repo: WorksheetQueryPort;
  private readonly exporter: WorksheetExporterPort;

  constructor({ repo, exporter }: WorksheetServiceDeps) {
    this.repo = repo;
    this.exporter = exporter;
  }

  /**
   * Generate a 12-column Worksheet report.
   *
   * - RBAC gate: rejects if role not in ALLOWED_ROLES — BEFORE any DB call
   * - Date validation: dateFrom must not be after dateTo
   * - Filter resolution: date range + optional fiscalPeriodId intersection
   * - Dual aggregation via Promise.all: sumas (isAdjustment=false) + ajustes (isAdjustment=true)
   * - Pure builder: no DB access after the two aggregations
   */
  async generateWorksheet(
    orgId: string,
    role: Role,
    filters: WorksheetFilters,
  ): Promise<WorksheetReport> {
    // 1. RBAC gate — BEFORE any DB query
    assertWorksheetAccess(role);

    // 2. Validate date range order
    const { dateFrom, dateTo, fiscalPeriodId } = filters;

    if (dateFrom > dateTo) {
      throw new ValidationError(
        "dateFrom no puede ser posterior a dateTo",
      );
    }

    // 3. Resolve effective range
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

  /**
   * Genera la Hoja de Trabajo como PDF y retorna el Buffer.
   *
   * [EXPORT] cluster paydown — generalizes the pattern
   * `FinancialStatementsService.exportBalanceSheetPdf` already used.
   */
  async exportPdf(
    report: WorksheetReport,
    orgName: string,
    orgNit?: string,
    orgAddress?: string,
    orgCity?: string,
  ): Promise<Buffer> {
    return this.exporter.exportPdf(report, orgName, orgNit, orgAddress, orgCity);
  }

  /**
   * Genera la Hoja de Trabajo como Excel (XLSX) y retorna el Buffer.
   *
   * Narrower than `exportPdf` — mirrors the underlying `exportWorksheetXlsx`
   * signature exactly (`report, orgName` only).
   */
  async exportXlsx(report: WorksheetReport, orgName: string): Promise<Buffer> {
    return this.exporter.exportXlsx(report, orgName);
  }
}
