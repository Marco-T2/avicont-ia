import { ForbiddenError, NotFoundError, ValidationError } from "@/features/shared/errors";
import type { Role } from "@/features/shared/permissions";
import { resolveBalances } from "./balance-source.resolver";
import { buildBalanceSheet } from "./balance-sheet.builder";
import { buildIncomeStatement } from "./income-statement.builder";
import { calculateRetainedEarnings } from "./retained-earnings.calculator";
import { FinancialStatementsRepository } from "./financial-statements.repository";
import type { BalanceSheet, IncomeStatement } from "./financial-statements.types";
import {
  exportBalanceSheetPdf,
  exportIncomeStatementPdf,
} from "./exporters/pdf.exporter";
import {
  exportBalanceSheetExcel,
  exportIncomeStatementExcel,
} from "./exporters/excel.exporter";

// ── Tipos de entrada públicos ──

export type GenerateBalanceSheetInput = {
  /** Fecha de corte del Balance General */
  asOfDate: Date;
  /** Si se provee, se intenta usar snapshot del período cerrado */
  fiscalPeriodId?: string;
};

export type GenerateIncomeStatementInput = {
  /** Si se provee, se deriva el rango desde el período fiscal */
  fiscalPeriodId?: string;
  /** Fecha de inicio del rango (requerido si no hay fiscalPeriodId) */
  dateFrom?: Date;
  /** Fecha de fin del rango (requerido si no hay fiscalPeriodId) */
  dateTo?: Date;
};

// ── Roles autorizados a ver estados financieros (REQ-13) ──
const ALLOWED_ROLES: Role[] = ["owner", "admin", "contador"];

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
   * Flujo (design §2):
   * 1. Gate RBAC
   * 2. Resolver la fuente de saldos (snapshot vs on-the-fly) vía balanceSourceResolver
   * 3. Obtener metadata de cuentas
   * 4. Calcular Utilidad del Ejercicio (single source of truth vía IncomeStatement)
   * 5. Construir el Balance con el builder puro
   * 6. Si está desbalanceado → escribir audit log (no bloquea)
   */
  async generateBalanceSheet(
    orgId: string,
    userRole: Role,
    input: GenerateBalanceSheetInput,
  ): Promise<BalanceSheet> {
    // 1. Gate RBAC
    assertFinancialStatementsAccess(userRole);

    // 2. Resolver la fuente de saldos (período cerrado vs on-the-fly)
    const resolved = await resolveBalances(this.repo, {
      orgId,
      date: input.asOfDate,
      periodId: input.fiscalPeriodId,
    });

    // 3. Determinar el estado y rango del período para el cálculo de utilidad
    let periodStatus: "OPEN" | "CLOSED" | null = null;
    let incomeFrom: Date = new Date(input.asOfDate.getFullYear(), 0, 1); // Inicio del año fiscal por defecto
    let incomeTo: Date = input.asOfDate;

    if (input.fiscalPeriodId) {
      const period = await this.repo.findFiscalPeriod(orgId, input.fiscalPeriodId);
      if (period) {
        periodStatus = period.status as "OPEN" | "CLOSED";
        incomeFrom = period.startDate;
        incomeTo = input.asOfDate;
      }
    }

    // 4. Obtener metadata de cuentas (para agrupación por subtype)
    const accounts = await this.repo.findAccountsWithSubtype(orgId);

    // 5. Calcular Utilidad del Ejercicio — single source of truth (REQ-3)
    // Se agrega el rango del período para obtener los movimientos de ingresos/gastos
    const incomeMovements = await this.repo.aggregateJournalLinesInRange(
      orgId,
      incomeFrom,
      incomeTo,
    );

    const incomeStatementCurrent = buildIncomeStatement({
      accounts,
      movements: incomeMovements,
      dateFrom: incomeFrom,
      dateTo: incomeTo,
      periodStatus,
      source: resolved.source,
    });

    const retainedEarnings = calculateRetainedEarnings(incomeStatementCurrent);

    // 6. Construir el Balance General
    const current = buildBalanceSheet({
      accounts,
      balances: resolved.balances,
      retainedEarningsOfPeriod: retainedEarnings,
      date: input.asOfDate,
      periodStatus,
      source: resolved.source,
    });

    // 7. Audit log si la ecuación contable está desbalanceada (REQ-6, D10)
    // Fire-and-forget deliberado: no bloquea la respuesta al cliente
    if (current.imbalanced) {
      this.repo
        .writeImbalanceAuditLog(orgId, {
          date: input.asOfDate,
          delta: current.imbalanceDelta,
        })
        .catch((err) => {
          // No silenciar completamente — loguear para visibilidad operacional
          console.error("[financial-statements] Error escribiendo audit log de desbalance:", err);
        });
    }

    return { orgId, current };
  }

  /**
   * Genera el Estado de Resultados para un rango de fechas o período fiscal.
   *
   * Flujo (design §2):
   * 1. Gate RBAC
   * 2. Resolver el rango de fechas (desde período o desde input directo)
   * 3. Agregar movimientos del rango
   * 4. Construir el Estado de Resultados con el builder puro
   *
   * La marca `preliminary` es siempre true cuando:
   * - No se provee fiscalPeriodId (rango libre), O
   * - El período está OPEN
   */
  async generateIncomeStatement(
    orgId: string,
    userRole: Role,
    input: GenerateIncomeStatementInput,
  ): Promise<IncomeStatement> {
    // 1. Gate RBAC
    assertFinancialStatementsAccess(userRole);

    // 2. Resolver el rango de fechas
    let dateFrom: Date;
    let dateTo: Date;
    let periodStatus: "OPEN" | "CLOSED" | null = null;
    let source: "snapshot" | "on-the-fly" = "on-the-fly";

    if (input.fiscalPeriodId) {
      const period = await this.repo.findFiscalPeriod(orgId, input.fiscalPeriodId);
      if (!period) {
        // NotFoundError será lanzado por el route handler — re-throw
        throw new NotFoundError("Período fiscal");
      }
      dateFrom = period.startDate;
      dateTo = period.endDate;
      periodStatus = period.status as "OPEN" | "CLOSED";
      source = periodStatus === "CLOSED" ? "snapshot" : "on-the-fly";
    } else if (input.dateFrom && input.dateTo) {
      dateFrom = input.dateFrom;
      dateTo = input.dateTo;
      // Sin período → siempre on-the-fly + preliminary
      source = "on-the-fly";
    } else {
      throw new ValidationError(
        "Se requiere fiscalPeriodId o dateFrom + dateTo para generar el Estado de Resultados",
      );
    }

    // 3. Obtener cuentas y movimientos
    const [accounts, movements] = await Promise.all([
      this.repo.findAccountsWithSubtype(orgId),
      this.repo.aggregateJournalLinesInRange(orgId, dateFrom, dateTo),
    ]);

    // 4. Construir el Estado de Resultados
    const current = buildIncomeStatement({
      accounts,
      movements,
      dateFrom,
      dateTo,
      periodStatus,
      source,
    });

    return { orgId, current };
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
