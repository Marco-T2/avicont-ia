import "server-only";
import { ForbiddenError, ValidationError } from "@/features/shared/errors";
import type { Role } from "@/features/shared/permissions";
import { EquityStatementRepository } from "./equity-statement.repository";
import { buildEquityStatement } from "./equity-statement.builder";
import type { EquityStatement } from "./equity-statement.types";
// Reutilización de FS — fuente única de verdad del Resultado del Ejercicio (REQ-4)
import { FinancialStatementsRepository } from "@/features/accounting/financial-statements/financial-statements.repository";
import { buildIncomeStatement } from "@/features/accounting/financial-statements/income-statement.builder";
import { calculateRetainedEarnings } from "@/features/accounting/financial-statements/retained-earnings.calculator";

const ALLOWED_ROLES: Role[] = ["owner", "admin", "contador"];

export type GenerateEquityStatementInput = { dateFrom: Date; dateTo: Date };

export class EquityStatementService {
  constructor(
    private readonly repo = new EquityStatementRepository(),
    private readonly fsRepo = new FinancialStatementsRepository(),
  ) {}

  async generate(
    orgId: string,
    role: Role,
    input: GenerateEquityStatementInput,
  ): Promise<EquityStatement> {
    // 1. RBAC gate — before any DB call (REQ-9)
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

    const dayBefore = new Date(input.dateFrom);
    dayBefore.setUTCDate(dayBefore.getUTCDate() - 1);

    // 3. Parallel data loads — 6 queries (REQ-3, REQ-8)
    const [initialBalances, finalBalances, accounts, fsAccounts, incomeMovements, isClosedMatch] =
      await Promise.all([
        this.repo.getPatrimonioBalancesAt(orgId, dayBefore),
        this.repo.getPatrimonioBalancesAt(orgId, input.dateTo),
        this.repo.findPatrimonioAccounts(orgId),
        // Pipeline ER — same pattern as FinancialStatementsService (lines 219-235)
        this.fsRepo.findAccountsWithSubtype(orgId),
        this.fsRepo.aggregateJournalLinesInRange(orgId, input.dateFrom, input.dateTo),
        this.repo.isClosedPeriodMatch(orgId, input.dateFrom, input.dateTo),
      ]);

    // 4. Build Income Statement and derive periodResult — shared source of truth (REQ-4)
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
      periodResult,
      dateFrom: input.dateFrom,
      dateTo: input.dateTo,
      preliminary: !isClosedMatch,
    });

    // 6. Inject orgId (builder leaves it empty — separation of concerns)
    return { ...statement, orgId };
  }
}
