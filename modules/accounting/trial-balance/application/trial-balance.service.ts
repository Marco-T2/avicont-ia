import { ForbiddenError, ValidationError } from "@/modules/shared/domain/errors";
import { PERMISSIONS_READ, type Role } from "@/modules/permissions/domain/permissions";
import type { TrialBalanceQueryPort } from "../domain/ports/trial-balance-query.port";
import type { TrialBalanceExporterPort } from "../domain/ports/trial-balance-exporter.port";
import { buildTrialBalance } from "../domain/trial-balance.builder";
import type { TrialBalanceFilters, TrialBalanceReport } from "../domain/trial-balance.types";

// ── RBAC ──────────────────────────────────────────────────────────────────────

/**
 * Roles autorizados para acceder al Balance de Sumas y Saldos.
 * Source of truth: PERMISSIONS_READ["financial-statements"] en el dominio.
 */
const ALLOWED_ROLES: readonly Role[] = PERMISSIONS_READ["financial-statements"];

function assertTrialBalanceAccess(role: Role): void {
  if (!ALLOWED_ROLES.includes(role)) {
    throw new ForbiddenError(
      "Solo los roles owner, admin y contador pueden acceder al Balance de Sumas y Saldos",
      "FORBIDDEN",
    );
  }
}

// ── Deps ──────────────────────────────────────────────────────────────────────

/**
 * Dependency injection contract for TrialBalanceService.
 *
 * Simpler than FinancialStatementsServiceDeps: no AccountSubtypeLabelPort
 * (trial-balance does not break down by account subtype label).
 */
interface TrialBalanceServiceDeps {
  repo: TrialBalanceQueryPort;
  /** [EXPORT] cluster paydown — injected exporter port (generalizes the
   *  pattern financial-statements.service.ts already used). */
  exporter: TrialBalanceExporterPort;
}

// ── Service ───────────────────────────────────────────────────────────────────

/**
 * TrialBalanceService — RBAC gate + orchestration.
 *
 * Deps-object ctor per [[API_breaking_change_C1_blocks_C4_test_migration]].
 * NO server-only directive — application layer is pure orchestration.
 * Server-only boundary lives in presentation/server.ts (REQ-002).
 *
 * Does NOT import Prisma directly. All DB access goes through TrialBalanceQueryPort.
 * Serialization happens at the route boundary — NOT inside this service.
 */
export class TrialBalanceService {
  private readonly repo: TrialBalanceQueryPort;
  private readonly exporter: TrialBalanceExporterPort;

  constructor({ repo, exporter }: TrialBalanceServiceDeps) {
    this.repo = repo;
    this.exporter = exporter;
  }

  /**
   * Generate a Balance de Comprobación de Sumas y Saldos.
   *
   * - RBAC gate: rejects if role not in ALLOWED_ROLES — BEFORE any DB call
   * - Date validation: dateFrom must not be after dateTo
   * - Parallel data load: findAccounts + aggregateAllVouchers (all voucher types)
   * - Pure builder: no DB access after the two loads
   */
  async generate(
    orgId: string,
    role: Role,
    filters: TrialBalanceFilters,
  ): Promise<TrialBalanceReport> {
    // 1. RBAC gate — BEFORE any DB query
    assertTrialBalanceAccess(role);

    // 2. Validate date range
    if (filters.dateFrom > filters.dateTo) {
      throw new ValidationError("dateFrom no puede ser posterior a dateTo");
    }

    // 3. Parallel data load
    const [accounts, movements] = await Promise.all([
      this.repo.findAccounts(orgId),
      this.repo.aggregateAllVouchers(orgId, filters.dateFrom, filters.dateTo),
    ]);

    // 4. Pure builder — no DB access after this point
    const report = buildTrialBalance({
      accounts,
      movements,
      dateFrom: filters.dateFrom,
      dateTo: filters.dateTo,
    });

    // 5. Inject orgId (builder leaves it blank — service knows the real orgId)
    return { ...report, orgId };
  }

  /**
   * Genera el Balance de Comprobación como PDF y retorna el Buffer.
   *
   * [EXPORT] cluster paydown — generalizes the pattern
   * `FinancialStatementsService.exportBalanceSheetPdf` already used.
   */
  async exportPdf(
    report: TrialBalanceReport,
    orgName: string,
    orgNit?: string,
    orgAddress?: string,
    orgCity?: string,
  ): Promise<Buffer> {
    return this.exporter.exportPdf(report, orgName, orgNit, orgAddress, orgCity);
  }

  /**
   * Genera el Balance de Comprobación como Excel (XLSX) y retorna el Buffer.
   */
  async exportXlsx(
    report: TrialBalanceReport,
    orgName: string,
    orgNit?: string,
    orgAddress?: string,
  ): Promise<Buffer> {
    return this.exporter.exportXlsx(report, orgName, orgNit, orgAddress);
  }
}
