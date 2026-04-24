import "server-only";
import { ForbiddenError, NotFoundError, ValidationError } from "@/features/shared/errors";
import type { Role } from "@/features/permissions";
import { buildBalanceSheet } from "./balance-sheet.builder";
import { buildIncomeStatement } from "./income-statement.builder";
import { calculateRetainedEarnings } from "./retained-earnings.calculator";
import { FinancialStatementsRepository } from "./financial-statements.repository";
import type {
  BalanceSheet,
  BalanceSheetCurrent,
  IncomeStatement,
  IncomeStatementCurrent,
  StatementColumn,
  DatePresetId,
  BreakdownBy,
  CompareWith,
} from "./financial-statements.types";
import {
  resolveDatePreset,
  applyFilterPrecedence,
  generateBreakdownBuckets,
  resolveComparativePeriod,
} from "./date-presets.utils";
import type { DateRange } from "./date-presets.utils";
import {
  exportBalanceSheetPdf,
  exportIncomeStatementPdf,
} from "./exporters/pdf.exporter";
import {
  exportBalanceSheetExcel,
  exportIncomeStatementExcel,
} from "./exporters/excel.exporter";

// ── Tipos de entrada públicos ──

type GenerateBalanceSheetInput = {
  /** Fecha de corte del Balance General */
  asOfDate: Date;
  /** Si se provee, se intenta usar snapshot del período cerrado */
  fiscalPeriodId?: string;
  /** Macro de período (PR2) */
  preset?: DatePresetId;
  /** Granularidad de columnas, por defecto "total" (PR2) */
  breakdownBy?: BreakdownBy;
  /** Modo comparativo, por defecto "none" (PR2) */
  compareWith?: CompareWith;
  /** Fecha de corte del período comparativo cuando compareWith="custom" (PR2) */
  compareAsOfDate?: Date;
};

type GenerateIncomeStatementInput = {
  /** Si se provee, se deriva el rango desde el período fiscal */
  fiscalPeriodId?: string;
  /** Fecha de inicio del rango (requerido si no hay fiscalPeriodId ni preset) */
  dateFrom?: Date;
  /** Fecha de fin del rango (requerido si no hay fiscalPeriodId ni preset) */
  dateTo?: Date;
  /** Macro de período (PR2) */
  preset?: DatePresetId;
  /** Granularidad de columnas, por defecto "total" (PR2) */
  breakdownBy?: BreakdownBy;
  /** Modo comparativo, por defecto "none" (PR2) */
  compareWith?: CompareWith;
  /** Inicio del período comparativo cuando compareWith="custom" (PR2) */
  compareDateFrom?: Date;
  /** Fin del período comparativo cuando compareWith="custom" (PR2) */
  compareDateTo?: Date;
};

// ── Roles autorizados a ver estados financieros (REQ-13) ──
const ALLOWED_ROLES: Role[] = ["owner", "admin", "contador"];

// ── Helpers de columnas — puros, sin Prisma (PR2) ──

/**
 * Construye las StatementColumn[] comparativas a partir del rango comparativo.
 * Genera una columna comparative y una diff_percent por cada columna current del main.
 *
 * Pura: recibe data ya calculada, retorna columnas extendidas.
 */
function buildComparativeColumns(
  currentColumns: StatementColumn[],
  comparativeRange: DateRange,
): StatementColumn[] {
  const extra: StatementColumn[] = [];

  for (const col of currentColumns) {
    // Columna comparativa espejada con el mismo id prefijado
    extra.push({
      id: `${col.id}-comp`,
      label: `Comparativo`,
      dateFrom: comparativeRange.dateFrom,
      dateTo: comparativeRange.dateTo,
      role: "comparative",
    });
    // Columna de diferencia porcentual
    extra.push({
      id: `${col.id}-diff`,
      label: `Var %`,
      role: "diff_percent",
    });
  }

  return extra;
}

/**
 * Valida que el rol tenga acceso a los estados financieros.
 * Lanza ForbiddenError si el rol no está permitido.
 * Equivalente a requireRole(["owner","admin","contador"]) en el route handler.
 */
function assertFinancialStatementsAccess(userRole: Role): void {
  if (!ALLOWED_ROLES.includes(userRole)) {
    throw new ForbiddenError(
      "Solo los roles owner, admin y contador pueden acceder a los estados financieros",
      "FORBIDDEN",
    );
  }
}

/**
 * Orquestador de estados financieros.
 *
 * Responsabilidades:
 * - Gate RBAC en el entry point
 * - Coordinar repo + resolver + builders (sin tocar Prisma directamente)
 * - Calcular la marca `preliminary` según las reglas del dominio
 * - Disparar el audit log si la ecuación contable está desbalanceada
 *
 * IMPORTANTE: este service no importa Prisma. Toda la persistencia va por el repo.
 */
export class FinancialStatementsService {
  private readonly repo: FinancialStatementsRepository;

  constructor(repo?: FinancialStatementsRepository) {
    this.repo = repo ?? new FinancialStatementsRepository();
  }

  /**
   * Genera el Balance General (Estado de Situación Patrimonial) a la fecha de corte.
   *
   * Flujo PR2 (diseño §6):
   * 1. Gate RBAC
   * 2. Resolver rango: preset → applyFilterPrecedence → resolvedRange
   * 3. generateBreakdownBuckets → StatementColumn[] (buckets para columnas)
   * 4. aggregateJournalLinesUpToBulk → Map<columnId, MovementAggregation[]>
   * 5. Por cada bucket → resolveBalances (usando aggregations) → buildBalanceSheet
   * 6. Si compareWith ≠ none → comparativo paralelo
   * 7. Retornar { orgId, current (legacy=first column), comparative?, columns }
   *
   * Backward compat: sin nuevos params → breakdownBy="total", compareWith="none",
   * columns tiene 1 elemento, current y comparative se mantienen sin cambios.
   */
  async generateBalanceSheet(
    orgId: string,
    userRole: Role,
    input: GenerateBalanceSheetInput,
  ): Promise<BalanceSheet> {
    // 1. Gate RBAC
    assertFinancialStatementsAccess(userRole);

    const breakdownBy = input.breakdownBy ?? "total";
    const compareWith = input.compareWith ?? "none";

    // 2. Resolver rango efectivo
    // El asOfDate siempre es la fecha de corte para BS (incluso sin preset)
    let resolvedRange: DateRange;
    let periodStatus: "OPEN" | "CLOSED" | null = null;

    if (input.fiscalPeriodId) {
      const period = await this.repo.findFiscalPeriod(orgId, input.fiscalPeriodId);
      if (period) {
        periodStatus = period.status as "OPEN" | "CLOSED";
        // Para BS el rango va desde inicio del período hasta asOfDate
        resolvedRange = {
          dateFrom: period.startDate,
          dateTo: input.asOfDate,
        };
      } else {
        resolvedRange = { dateFrom: new Date(input.asOfDate.getFullYear(), 0, 1), dateTo: input.asOfDate };
      }
    } else if (input.preset) {
      const [from, to] = resolveDatePreset(input.preset, { tz: "America/La_Paz" });
      resolvedRange = { dateFrom: from, dateTo: to };
    } else {
      // Fallback: rango desde inicio del año hasta asOfDate (legacy)
      resolvedRange = {
        dateFrom: new Date(Date.UTC(input.asOfDate.getUTCFullYear(), 0, 1)),
        dateTo: input.asOfDate,
      };
    }

    // 3. Generar buckets de columnas
    const buckets = generateBreakdownBuckets(resolvedRange, breakdownBy);

    // 4. Obtener metadata de cuentas (una sola vez)
    const accounts = await this.repo.findAccountsWithSubtype(orgId);

    // 5. Agregar movimientos en paralelo para todas las columnas BS (upTo = asOfDate del bucket)
    const bsBuckets = buckets.map((col) => ({
      columnId: col.id,
      asOfDate: col.asOfDate ?? col.dateTo ?? input.asOfDate,
    }));

    const aggregationsMap = await this.repo.aggregateJournalLinesUpToBulk(orgId, bsBuckets);

    // 6. Construir BalanceSheetCurrent por cada columna
    const columnCurrents = await Promise.all(
      buckets.map(async (col) => {
        const colAggregations = aggregationsMap.get(col.id) ?? [];
        const asOf = col.asOfDate ?? col.dateTo ?? input.asOfDate;

        // Calcular utilidad del ejercicio para este corte (inicio año → asOf)
        const incomeFrom = new Date(Date.UTC(asOf.getUTCFullYear(), 0, 1));
        const incomeMovements = await this.repo.aggregateJournalLinesInRange(
          orgId,
          incomeFrom,
          asOf,
        );

        const incomeStatCurrent = buildIncomeStatement({
          accounts,
          movements: incomeMovements,
          dateFrom: incomeFrom,
          dateTo: asOf,
          periodStatus,
          source: "on-the-fly",
        });

        const retainedEarnings = calculateRetainedEarnings(incomeStatCurrent);

        // Convertir aggregations a ResolvedBalance (aplicar convención de signo)
        const balances = colAggregations.map((a) => ({
          accountId: a.accountId,
          balance:
            a.nature === "DEUDORA"
              ? a.totalDebit.minus(a.totalCredit)
              : a.totalCredit.minus(a.totalDebit),
        }));

        return buildBalanceSheet({
          accounts,
          balances,
          retainedEarningsOfPeriod: retainedEarnings,
          date: asOf,
          periodStatus,
          source: "on-the-fly",
        });
      }),
    );

    // 7. Columna "current" legacy = primera columna (backward compat)
    const current = columnCurrents[0];

    // Audit log si la primera columna está desbalanceada (REQ-6, D10)
    if (current.imbalanced) {
      this.repo
        .writeImbalanceAuditLog(orgId, {
          date: input.asOfDate,
          delta: current.imbalanceDelta,
        })
        .catch((err) => {
          console.error("[financial-statements] Error escribiendo audit log de desbalance:", err);
        });
    }

    // 8. Comparative si se solicita
    let comparative: BalanceSheetCurrent | undefined;
    let allColumns = [...buckets];

    if (compareWith !== "none") {
      const customCompRange =
        compareWith === "custom" && input.compareAsOfDate
          ? {
              dateFrom: new Date(Date.UTC(input.compareAsOfDate.getUTCFullYear(), 0, 1)),
              dateTo: input.compareAsOfDate,
            }
          : undefined;

      const compRange = resolveComparativePeriod(resolvedRange, compareWith, {
        customRange: customCompRange,
      });

      if (compRange) {
        // Comparative es siempre single-column (el mismo breakdownBy pero sobre compRange)
        // Según diseño §6: comparative period → mismo flujo single range
        const compAggregations = await this.repo.aggregateJournalLinesUpTo(orgId, compRange.dateTo);
        const compIncomeFrom = new Date(Date.UTC(compRange.dateTo.getUTCFullYear(), 0, 1));
        const compIncomeMovements = await this.repo.aggregateJournalLinesInRange(
          orgId,
          compIncomeFrom,
          compRange.dateTo,
        );
        const compIncomeStat = buildIncomeStatement({
          accounts,
          movements: compIncomeMovements,
          dateFrom: compIncomeFrom,
          dateTo: compRange.dateTo,
          periodStatus: null,
          source: "on-the-fly",
        });
        const compRetained = calculateRetainedEarnings(compIncomeStat);
        const compBalances = compAggregations.map((a) => ({
          accountId: a.accountId,
          balance:
            a.nature === "DEUDORA"
              ? a.totalDebit.minus(a.totalCredit)
              : a.totalCredit.minus(a.totalDebit),
        }));
        comparative = buildBalanceSheet({
          accounts,
          balances: compBalances,
          retainedEarningsOfPeriod: compRetained,
          date: compRange.dateTo,
          periodStatus: null,
          source: "on-the-fly",
        });

        // Añadir columnas comparativas + diff_percent
        const compCols = buildComparativeColumns(buckets, compRange);
        allColumns = [...allColumns, ...compCols];
      }
    }

    return { orgId, current, comparative, columns: allColumns };
  }

  /**
   * Genera el Estado de Resultados para un rango de fechas o período fiscal.
   *
   * Flujo PR2 (diseño §6):
   * 1. Gate RBAC
   * 2. Resolver rango base: fiscalPeriod > preset > custom (applyFilterPrecedence)
   * 3. generateBreakdownBuckets → StatementColumn[]
   * 4. aggregateJournalLinesInRangeBulk → Map<columnId, MovementAggregation[]>
   * 5. buildIncomeStatement por columna
   * 6. Comparative si compareWith ≠ none
   * 7. Retornar { orgId, current (legacy=first column), comparative?, columns }
   *
   * Backward compat: sin nuevos params → breakdownBy="total", 1 columna, current idéntico.
   */
  async generateIncomeStatement(
    orgId: string,
    userRole: Role,
    input: GenerateIncomeStatementInput,
  ): Promise<IncomeStatement> {
    // 1. Gate RBAC
    assertFinancialStatementsAccess(userRole);

    const breakdownBy = input.breakdownBy ?? "total";
    const compareWith = input.compareWith ?? "none";

    // 2. Resolver rango base
    let dateFrom: Date;
    let dateTo: Date;
    let periodStatus: "OPEN" | "CLOSED" | null = null;
    let source: "snapshot" | "on-the-fly" = "on-the-fly";

    if (input.fiscalPeriodId) {
      const period = await this.repo.findFiscalPeriod(orgId, input.fiscalPeriodId);
      if (!period) {
        throw new NotFoundError("Período fiscal");
      }
      dateFrom = period.startDate;
      dateTo = period.endDate;
      periodStatus = period.status as "OPEN" | "CLOSED";
      source = periodStatus === "CLOSED" ? "snapshot" : "on-the-fly";
    } else if (input.preset) {
      const [from, to] = resolveDatePreset(input.preset, { tz: "America/La_Paz" });
      // applyFilterPrecedence con solo preset
      const resolved = applyFilterPrecedence({ presetRange: { dateFrom: from, dateTo: to } });
      dateFrom = resolved.dateFrom;
      dateTo = resolved.dateTo;
    } else if (input.dateFrom && input.dateTo) {
      // applyFilterPrecedence con solo custom
      const resolved = applyFilterPrecedence({
        customRange: { dateFrom: input.dateFrom, dateTo: input.dateTo },
      });
      dateFrom = resolved.dateFrom;
      dateTo = resolved.dateTo;
    } else {
      throw new ValidationError(
        "Se requiere fiscalPeriodId, preset, o dateFrom + dateTo para generar el Estado de Resultados",
      );
    }

    const resolvedRange: DateRange = { dateFrom, dateTo };

    // 3. Generar buckets
    const buckets = generateBreakdownBuckets(resolvedRange, breakdownBy);

    // 4. Obtener cuentas y movimientos en bulk (paralelo)
    const isBuckets = buckets.map((col) => ({
      columnId: col.id,
      dateFrom: col.dateFrom ?? dateFrom,
      dateTo: col.dateTo ?? dateTo,
    }));

    const [accounts, aggregationsMap] = await Promise.all([
      this.repo.findAccountsWithSubtype(orgId),
      this.repo.aggregateJournalLinesInRangeBulk(orgId, isBuckets),
    ]);

    // 5. Construir IncomeStatementCurrent por columna
    const columnCurrents: IncomeStatementCurrent[] = buckets.map((col) => {
      const movements = aggregationsMap.get(col.id) ?? [];
      return buildIncomeStatement({
        accounts,
        movements,
        dateFrom: col.dateFrom ?? dateFrom,
        dateTo: col.dateTo ?? dateTo,
        periodStatus,
        source,
      });
    });

    // 6. Columna "current" legacy = primera columna (backward compat)
    const current = columnCurrents[0];
    let allColumns = [...buckets];

    // 7. Comparative si se solicita
    let comparative: IncomeStatementCurrent | undefined;

    if (compareWith !== "none") {
      const customCompRange =
        compareWith === "custom" && input.compareDateFrom && input.compareDateTo
          ? { dateFrom: input.compareDateFrom, dateTo: input.compareDateTo }
          : undefined;

      const compRange = resolveComparativePeriod(resolvedRange, compareWith, {
        customRange: customCompRange,
      });

      if (compRange) {
        const compMovements = await this.repo.aggregateJournalLinesInRange(
          orgId,
          compRange.dateFrom,
          compRange.dateTo,
        );
        comparative = buildIncomeStatement({
          accounts,
          movements: compMovements,
          dateFrom: compRange.dateFrom,
          dateTo: compRange.dateTo,
          periodStatus: null,
          source: "on-the-fly",
        });

        const compCols = buildComparativeColumns(buckets, compRange);
        allColumns = [...allColumns, ...compCols];
      }
    }

    return { orgId, current, comparative, columns: allColumns };
  }

  // ── Exporters — implementados en PR4 ──

  /**
   * Genera el Balance General como PDF y retorna el Buffer.
   *
   * @param orgName Nombre de la organización para el encabezado del documento.
   *                El route handler lo provee desde requireOrgAccess / parámetro URL.
   */
  async exportBalanceSheetPdf(
    orgId: string,
    userRole: Role,
    input: GenerateBalanceSheetInput,
    orgName: string,
  ): Promise<Buffer> {
    assertFinancialStatementsAccess(userRole);
    const statement = await this.generateBalanceSheet(orgId, userRole, input);
    return exportBalanceSheetPdf(statement, orgName);
  }

  /**
   * Genera el Balance General como Excel (XLSX) y retorna el Buffer.
   */
  async exportBalanceSheetXlsx(
    orgId: string,
    userRole: Role,
    input: GenerateBalanceSheetInput,
    orgName: string,
  ): Promise<Buffer> {
    assertFinancialStatementsAccess(userRole);
    const statement = await this.generateBalanceSheet(orgId, userRole, input);
    return exportBalanceSheetExcel(statement, orgName);
  }

  /**
   * Genera el Estado de Resultados como PDF y retorna el Buffer.
   */
  async exportIncomeStatementPdf(
    orgId: string,
    userRole: Role,
    input: GenerateIncomeStatementInput,
    orgName: string,
  ): Promise<Buffer> {
    assertFinancialStatementsAccess(userRole);
    const statement = await this.generateIncomeStatement(orgId, userRole, input);
    return exportIncomeStatementPdf(statement, orgName);
  }

  /**
   * Genera el Estado de Resultados como Excel (XLSX) y retorna el Buffer.
   */
  async exportIncomeStatementXlsx(
    orgId: string,
    userRole: Role,
    input: GenerateIncomeStatementInput,
    orgName: string,
  ): Promise<Buffer> {
    assertFinancialStatementsAccess(userRole);
    const statement = await this.generateIncomeStatement(orgId, userRole, input);
    return exportIncomeStatementExcel(statement, orgName);
  }
}
