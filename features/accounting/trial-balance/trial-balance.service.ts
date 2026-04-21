import "server-only";
import { ForbiddenError, ValidationError } from "@/features/shared/errors";
import type { Role } from "@/features/shared/permissions";
import { TrialBalanceRepository } from "./trial-balance.repository";
import { buildTrialBalance } from "./trial-balance.builder";
import type { TrialBalanceFilters, TrialBalanceReport } from "./trial-balance.types";

// ── RBAC ──────────────────────────────────────────────────────────────────────

/** Roles autorizados para acceder al Balance de Sumas y Saldos. */
const ALLOWED_ROLES: Role[] = ["owner", "admin", "contador"];

function assertTrialBalanceAccess(role: Role): void {
  if (!ALLOWED_ROLES.includes(role)) {
    throw new ForbiddenError(
      "Solo los roles owner, admin y contador pueden acceder al Balance de Sumas y Saldos",
      "FORBIDDEN",
    );
  }
}

// ── Service ───────────────────────────────────────────────────────────────────

/**
 * TrialBalanceService — RBAC gate + orchestration.
 *
 * Does NOT import Prisma directly. All DB access goes through TrialBalanceRepository.
 * Serialization happens at the route boundary — NOT inside this service.
 */
export class TrialBalanceService {
  private readonly repo: TrialBalanceRepository;

  constructor(repo?: TrialBalanceRepository) {
    this.repo = repo ?? new TrialBalanceRepository();
  }

  /**
   * Generate a Balance de Comprobación de Sumas y Saldos.
   *
   * - RBAC gate (C11): rejects if role not in ALLOWED_ROLES — BEFORE any DB call
   * - Date validation: dateFrom must not be after dateTo
   * - Parallel data load: findAccounts + aggregateAllVouchers (all voucher types)
   * - Pure builder: no DB access after the two loads
   */
  async generate(
    orgId: string,
    role: Role,
    filters: TrialBalanceFilters,
  ): Promise<TrialBalanceReport> {
    // 1. RBAC gate — BEFORE any DB query (C11.E1)
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

    // 4. Pure builder
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
