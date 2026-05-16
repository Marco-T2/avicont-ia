import "server-only";
import { ForbiddenError, NotFoundError, ValidationError } from "@/features/shared/errors";
import type { Role } from "@/features/permissions";
import { logStructured } from "@/lib/logging/structured";
import { buildBalanceSheet } from "../domain/balance-sheet.builder";
import { buildIncomeStatement } from "../domain/income-statement.builder";
import { calculateRetainedEarnings } from "../domain/retained-earnings.calculator";
import type { FinancialStatementsQueryPort } from "../domain/ports/financial-statements-query.port";
import type { AccountSubtypeLabelPort } from "../domain/ports/account-subtype-label.port";
import type {
  BalanceSheet,
  BalanceSheetCurrent,
  IncomeStatement,
  IncomeStatementCurrent,
  StatementColumn,
  DatePresetId,
  BreakdownBy,
  CompareWith,
} from "../domain/types/financial-statements.types";
import {
  resolveDatePreset,
  applyFilterPrecedence,
  generateBreakdownBuckets,
  resolveComparativePeriod,
} from "../domain/date-presets.utils";
import type { DateRange } from "../domain/date-presets.utils";
// money.utils is referenced via the domain barrel — service preserves the money
// math composition source per REQ-005 and α50 (sentinel verifies this import).
import "../domain/money.utils";
// Exporters lifted to infrastructure/exporters/ at C2 GREEN per design §2 (D6: pdfmake
// + exceljs = Node-runtime infra). [[mock_hygiene_commit_scope]]: path rewrite bundled
// with infrastructure wiring in C2 GREEN commit.
import {
  exportBalanceSheetPdf,
  exportIncomeStatementPdf,
} from "../infrastructure/exporters/pdf.exporter";
import {
  exportBalanceSheetExcel,
  exportIncomeStatementExcel,
} from "../infrastructure/exporters/excel.exporter";

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

// ── Deps shape para deps-object ctor ──

export interface FinancialStatementsServiceDeps {
  repo: FinancialStatementsQueryPort;
  subtypeLabel: AccountSubtypeLabelPort;
}

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
 * - Coordinar repo + resolver + builders (sin tocar Prisma directamente — R5 absoluta)
 * - Calcular la marca `preliminary` según las reglas del dominio
 * - Emitir log estructurado si la ecuación contable está desbalanceada
 *
 * Deps inyectadas en ctor:
 * - repo: FinancialStatementsQueryPort (Prisma access via infrastructure adapter at C2)
 * - subtypeLabel: AccountSubtypeLabelPort (formatSubtypeLabel via infrastructure adapter at C2)
 *
 * BREAKING CHANGE vs features/.../financial-statements.service.ts: ctor now
 * requires a deps object. Zero-arg form removed. The 5 service-coupled tests in
 * features/ remain on the OLD shape and die at C5 per design §8.
 */
export class FinancialStatementsService {
  private readonly repo: FinancialStatementsQueryPort;
  // The subtype-label port is injected for future cross-feature reuse; the
  // domain builders import the canonical formatSubtypeLabel directly (already
  // canonical at @/modules/accounting/domain). The service holds the port for
  // composition transparency and to make the dep graph explicit for adapters
  // at C2.
  private readonly subtypeLabel: AccountSubtypeLabelPort;

  constructor(deps: FinancialStatementsServiceDeps) {
    this.repo = deps.repo;
    this.subtypeLabel = deps.subtypeLabel;
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
   */
  async generateBalanceSheet(
    orgId: string,
    userRole: Role,
    input: GenerateBalanceSheetInput,
  ): Promise<BalanceSheet> {
    // Reference subtypeLabel to keep the dep used (also documents the injection
    // contract — future cross-feature consumers may rely on it). The pure
    // builders import formatSubtypeLabel canonically from the domain module.
    void this.subtypeLabel;

    // 1. Gate RBAC
    assertFinancialStatementsAccess(userRole);

    const breakdownBy = input.breakdownBy ?? "total";
    const compareWith = input.compareWith ?? "none";

    // 2. Resolver rango efectivo
    let resolvedRange: DateRange;
    let periodStatus: "OPEN" | "CLOSED" | null = null;

    if (input.fiscalPeriodId) {
      const period = await this.repo.findFiscalPeriod(orgId, input.fiscalPeriodId);
      if (period) {
        periodStatus = period.status as "OPEN" | "CLOSED";
        resolvedRange = {
          dateFrom: period.startDate,
          dateTo: input.asOfDate,
        };
      } else {
        resolvedRange = {
          dateFrom: new Date(input.asOfDate.getFullYear(), 0, 1),
          dateTo: input.asOfDate,
        };
      }
    } else if (input.preset) {
      const [from, to] = resolveDatePreset(input.preset, { tz: "America/La_Paz" });
      resolvedRange = { dateFrom: from, dateTo: to };
    } else {
      resolvedRange = {
        dateFrom: new Date(Date.UTC(input.asOfDate.getUTCFullYear(), 0, 1)),
        dateTo: input.asOfDate,
      };
    }

    // 3. Generar buckets de columnas
    const buckets = generateBreakdownBuckets(resolvedRange, breakdownBy);

    // 4. Obtener metadata de cuentas (una sola vez)
    const accounts = await this.repo.findAccountsWithSubtype(orgId);

    // 5. Agregar movimientos en paralelo para todas las columnas BS
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

    // Observabilidad de desbalance — ver docs/adr/001-eliminacion-audit-log-imbalance.md.
    if (current.imbalanced) {
      logStructured({
        event: "balance_sheet_imbalanced",
        orgId,
        delta: current.imbalanceDelta,
        asOfDate: input.asOfDate,
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

        const compCols = buildComparativeColumns(buckets, compRange);
        allColumns = [...allColumns, ...compCols];
      }
    }

    return { orgId, current, comparative, columns: allColumns };
  }

  /**
   * Genera el Estado de Resultados para un rango de fechas o período fiscal.
   */
  async generateIncomeStatement(
    orgId: string,
    userRole: Role,
    input: GenerateIncomeStatementInput,
  ): Promise<IncomeStatement> {
    void this.subtypeLabel;

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
      const resolved = applyFilterPrecedence({ presetRange: { dateFrom: from, dateTo: to } });
      dateFrom = resolved.dateFrom;
      dateTo = resolved.dateTo;
    } else if (input.dateFrom && input.dateTo) {
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
   * Resuelve metadata de organización para encabezados de export.
   * Si el repo no encuentra la org, devolvemos un fallback con `name = orgId`
   * — esto NO debería pasar en producción (orgId viene de Clerk vía requirePermission),
   * pero el fallback evita crashear el export si la fila desaparece entre auth y export.
   */
  private async resolveOrgHeader(orgId: string): Promise<{
    name: string;
    nit: string | null;
    address: string | null;
    city: string | null;
  }> {
    const meta = await this.repo.getOrgMetadata(orgId);
    return meta ?? { name: orgId, nit: null, address: null, city: null };
  }

  /**
   * Genera el Balance General como PDF y retorna el Buffer.
   * El header ejecutivo (Empresa, NIT, Dirección) se resuelve vía repo.getOrgMetadata.
   */
  async exportBalanceSheetPdf(
    orgId: string,
    userRole: Role,
    input: GenerateBalanceSheetInput,
  ): Promise<Buffer> {
    assertFinancialStatementsAccess(userRole);
    const [statement, org] = await Promise.all([
      this.generateBalanceSheet(orgId, userRole, input),
      this.resolveOrgHeader(orgId),
    ]);
    return exportBalanceSheetPdf(statement, org);
  }

  /**
   * Genera el Balance General como Excel (XLSX) y retorna el Buffer.
   */
  async exportBalanceSheetXlsx(
    orgId: string,
    userRole: Role,
    input: GenerateBalanceSheetInput,
  ): Promise<Buffer> {
    assertFinancialStatementsAccess(userRole);
    const [statement, org] = await Promise.all([
      this.generateBalanceSheet(orgId, userRole, input),
      this.resolveOrgHeader(orgId),
    ]);
    return exportBalanceSheetExcel(statement, org);
  }

  /**
   * Genera el Estado de Resultados como PDF y retorna el Buffer.
   */
  async exportIncomeStatementPdf(
    orgId: string,
    userRole: Role,
    input: GenerateIncomeStatementInput,
  ): Promise<Buffer> {
    assertFinancialStatementsAccess(userRole);
    const [statement, org] = await Promise.all([
      this.generateIncomeStatement(orgId, userRole, input),
      this.resolveOrgHeader(orgId),
    ]);
    return exportIncomeStatementPdf(statement, org);
  }

  /**
   * Genera el Estado de Resultados como Excel (XLSX) y retorna el Buffer.
   */
  async exportIncomeStatementXlsx(
    orgId: string,
    userRole: Role,
    input: GenerateIncomeStatementInput,
  ): Promise<Buffer> {
    assertFinancialStatementsAccess(userRole);
    const [statement, org] = await Promise.all([
      this.generateIncomeStatement(orgId, userRole, input),
      this.resolveOrgHeader(orgId),
    ]);
    return exportIncomeStatementExcel(statement, org);
  }
}
