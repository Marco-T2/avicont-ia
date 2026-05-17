import { ForbiddenError, ValidationError } from "@/features/shared/errors";
import { PERMISSIONS_READ, type Role } from "@/features/permissions";
import type { TrialBalanceQueryPort } from "../domain/ports/trial-balance-query.port";
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

  constructor({ repo }: TrialBalanceServiceDeps) {
    this.repo = repo;
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
}
