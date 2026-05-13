import { ForbiddenError, ValidationError } from "@/features/shared/errors";
import type { Role } from "@/features/permissions";
import { addUTCDays } from "@/lib/date-utils";
import type { EquityStatementQueryPort } from "../domain/ports/equity-statement-query.port";
import type { EquityOrgMetadata } from "../domain/ports/equity-statement-query.port";
import { buildEquityStatement } from "../domain/equity-statement.builder";
import type { EquityStatement } from "../domain/equity-statement.types";
import type { IncomeStatementSourcePort } from "./income-statement-source.port";
// @domain-cross-module: FS pure functions tolerated per D10 (equity-statement design #2302 §7)
// NEGATIVE sentinel (REQ-011): NO @/modules/accounting/financial-statements/presentation
//   or @/modules/accounting/financial-statements/infrastructure imports permitted here.
import { buildIncomeStatement } from "@/modules/accounting/financial-statements/domain/income-statement.builder";
import { calculateRetainedEarnings } from "@/modules/accounting/financial-statements/domain/retained-earnings.calculator";

// ── RBAC ──────────────────────────────────────────────────────────────────────

/** Roles autorizados para acceder al EEPN. */
const ALLOWED_ROLES: Role[] = ["owner", "admin", "contador"];

type GenerateEquityStatementInput = { dateFrom: Date; dateTo: Date };

// ── Deps ──────────────────────────────────────────────────────────────────────

/**
 * Dependency injection contract for EquityStatementService.
 *
 * AXIS-DISTINCT vs TB (single-port): ES requires 2 ports:
 *   - repo: EquityStatementQueryPort (6-method domain port — patrimony data)
 *   - incomeSource: IncomeStatementSourcePort (2-method application port — FS raw data for ER)
 *
 * Breaking change from features/ ctor:
 *   BEFORE: constructor(repo = new EquityStatementRepository(), fsRepo = new PrismaFinancialStatementsRepo())
 *   AFTER:  constructor({ repo, incomeSource }: EquityStatementServiceDeps)
 * No zero-arg fallback, no optional args. Factory at presentation/composition-root.ts wires it.
 */
interface EquityStatementServiceDeps {
  repo: EquityStatementQueryPort;
  incomeSource: IncomeStatementSourcePort;
}

// ── Service ───────────────────────────────────────────────────────────────────

/**
 * EquityStatementService — RBAC gate + orchestration.
 *
 * Deps-object ctor per [[API_breaking_change_C1_blocks_C4_test_migration]].
 * NO 'server-only' directive — application layer is pure orchestration.
 * Server-only boundary lives in presentation/server.ts (REQ-002).
 *
 * Does NOT import Prisma directly. All DB access goes through ports.
 * D10: imports FS domain pure functions (buildIncomeStatement, calculateRetainedEarnings)
 * directly — DOMAIN→DOMAIN cross-module import tolerated per D10.
 * REQ-011 NEGATIVE: zero FS PRESENTATION or INFRASTRUCTURE imports here.
 */
export class EquityStatementService {
  private readonly repo: EquityStatementQueryPort;
  private readonly incomeSource: IncomeStatementSourcePort;

  constructor({ repo, incomeSource }: EquityStatementServiceDeps) {
    this.repo = repo;
    this.incomeSource = incomeSource;
  }

  /**
   * Generate an Estado de Evolucion del Patrimonio Neto (EEPN).
   *
   * - RBAC gate: rejects if role not in ALLOWED_ROLES — BEFORE any DB call
   * - Date validation: dateFrom must not be after dateTo
   * - Parallel data load: 8 queries (patrimony + income statement sources)
   * - D10: builds income statement from FS domain pure functions using incomeSource data
   * - Pure builder: no DB access after the parallel loads
   */
  async generate(
    orgId: string,
    role: Role,
    input: GenerateEquityStatementInput,
  ): Promise<EquityStatement> {
    // 1. RBAC gate — BEFORE any DB call (REQ-9)
    if (!ALLOWED_ROLES.includes(role)) {
      throw new ForbiddenError(
        "Solo los roles owner, admin y contador pueden acceder al EEPN",
        "FORBIDDEN",
      );
    }

    // 2. Date range validation (REQ-10)
    if (input.dateFrom > input.dateTo) {
      throw new ValidationError("dateFrom no puede ser posterior a dateTo");
    }

    const dayBefore = addUTCDays(input.dateFrom, -1);

    // 3. Parallel data loads — 8 queries (REQ-3, REQ-8)
    const [
      initialBalances,
      finalBalances,
      accounts,
      fsAccounts,
      incomeMovements,
      isClosedMatch,
      typedMovements,
      aperturaBaseline,
    ] = await Promise.all([
      this.repo.getPatrimonioBalancesAt(orgId, dayBefore),
      this.repo.getPatrimonioBalancesAt(orgId, input.dateTo),
      this.repo.findPatrimonioAccounts(orgId),
      // D10: FS income statement data via incomeSource port (not direct repo import)
      this.incomeSource.findAccountsWithSubtype(orgId),
      this.incomeSource.aggregateJournalLinesInRange(orgId, input.dateFrom, input.dateTo),
      this.repo.isClosedPeriodMatch(orgId, input.dateFrom, input.dateTo),
      this.repo.getTypedPatrimonyMovements(orgId, input.dateFrom, input.dateTo),
      this.repo.getAperturaPatrimonyDelta(orgId, input.dateFrom, input.dateTo),
    ]);

    // 4. Build Income Statement and derive periodResult — shared source of truth (REQ-4 / D10)
    const incomeStatement = buildIncomeStatement({
      accounts: fsAccounts,
      movements: incomeMovements,
      dateFrom: input.dateFrom,
      dateTo: input.dateTo,
      periodStatus: isClosedMatch ? "CLOSED" : null,
      source: "on-the-fly",
    });
    const periodResult = calculateRetainedEarnings(incomeStatement);

    // 5. Pure builder
    const statement = buildEquityStatement({
      initialBalances,
      finalBalances,
      accounts,
      typedMovements,
      aperturaBaseline,
      periodResult,
      dateFrom: input.dateFrom,
      dateTo: input.dateTo,
      preliminary: !isClosedMatch,
    });

    // 6. Inject orgId (builder leaves it empty — separation of concerns)
    return { ...statement, orgId };
  }

  /**
   * Retrieve org-level metadata (name, taxId, address) for report header.
   *
   * Per design §9.1 (axis-distinct vs TB): route.ts used to call
   * `repo.getOrgMetadata(orgId)` directly (infra instantiation antipattern).
   * Post-C4, route.ts delegates through this service method — no direct infra
   * import in route. Delegates to this.repo (EquityStatementQueryPort).
   */
  async getOrgMetadata(orgId: string): Promise<EquityOrgMetadata | null> {
    return this.repo.getOrgMetadata(orgId);
  }
}
