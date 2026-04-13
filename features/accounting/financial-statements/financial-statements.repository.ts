import { BaseRepository } from "@/features/shared/base.repository";
import { Prisma } from "@/generated/prisma/client";
import type { AccountSubtype } from "@/generated/prisma/enums";
import type { AccountMetadata, MovementAggregation } from "./financial-statements.types";

// ── Tipos de retorno específicos del repositorio ──

export type FiscalPeriodRow = {
  id: string;
  status: string;
  startDate: Date;
  endDate: Date;
};

export type AccountBalanceRow = {
  accountId: string;
  balance: Prisma.Decimal;
};

// Fila raw devuelta por las queries de agregación de JournalLine
type RawAggregation = {
  account_id: string;
  total_debit: string;
  total_credit: string;
  nature: "DEUDORA" | "ACREEDORA";
  subtype: AccountSubtype | null;
};

/**
 * Repositorio de estados financieros.
 * TODA la lógica de acceso a Prisma vive aquí — ningún import de Prisma en el service.
 *
 * Extends BaseRepository para heredar el cliente Prisma inyectable y requireOrg().
 */
export class FinancialStatementsRepository extends BaseRepository {
  /**
   * Busca un período fiscal por ID, scoped a la organización.
   * Retorna null si no existe.
   */
  async findFiscalPeriod(orgId: string, periodId: string): Promise<FiscalPeriodRow | null> {
    const scope = this.requireOrg(orgId);

    const period = await this.db.fiscalPeriod.findFirst({
      where: { id: periodId, ...scope },
      select: { id: true, status: true, startDate: true, endDate: true },
    });

    return period;
  }

  /**
   * Obtiene los saldos de AccountBalance para un período cerrado (snapshot).
   * El campo `balance` ya está signed-net por la convención del writer (D6):
   *   DEUDORA:   balance = debitTotal − creditTotal
   *   ACREEDORA: balance = creditTotal − debitTotal
   */
  async findAccountBalances(orgId: string, periodId: string): Promise<AccountBalanceRow[]> {
    const scope = this.requireOrg(orgId);

    const rows = await this.db.accountBalance.findMany({
      where: { ...scope, periodId },
      select: { accountId: true, balance: true },
    });

    return rows;
  }

  /**
   * Metadata de todas las cuentas activas con su subtype y nature.
   * Incluye cuentas de nivel 1 (subtype=null) para referencia; el builder las filtra.
   * Ordenadas por código para consistencia.
   */
  async findAccountsWithSubtype(orgId: string): Promise<AccountMetadata[]> {
    const scope = this.requireOrg(orgId);

    const accounts = await this.db.account.findMany({
      where: { ...scope, isActive: true },
      select: {
        id: true,
        code: true,
        name: true,
        level: true,
        subtype: true,
        nature: true,
        isActive: true,
      },
      orderBy: { code: "asc" },
    });

    // Mapear al tipo AccountMetadata (nature como string literal union)
    return accounts.map((a) => ({
      id: a.id,
      code: a.code,
      name: a.name,
      level: a.level,
      subtype: a.subtype as AccountSubtype | null,
      nature: a.nature as "DEUDORA" | "ACREEDORA",
      isActive: a.isActive,
    }));
  }

  /**
   * Agrega los movimientos de JournalLine de asientos POSTED hasta una fecha de corte.
   * Utilizado para el cálculo on-the-fly del Balance General.
   *
   * Usa $queryRaw para aplicar el filtro por relación (journalEntry.status = POSTED)
   * con GROUP BY accountId en una sola query — sin N+1 (REQ NFR Performance).
   *
   * Convención de signo: el caller (balance-source.resolver) aplica la naturaleza
   * para derivar el saldo signed-net.
   */
  async aggregateJournalLinesUpTo(orgId: string, date: Date): Promise<MovementAggregation[]> {
    // Formateamos la fecha como string ISO para la query parametrizada
    const cutoff = date;

    const rows = await this.db.$queryRaw<RawAggregation[]>`
      SELECT
        jl.account_id,
        SUM(jl.debit)  AS total_debit,
        SUM(jl.credit) AS total_credit,
        a.nature,
        a.subtype
      FROM journal_lines  jl
      JOIN journal_entries je ON je.id = jl.journal_entry_id
      JOIN accounts         a  ON a.id  = jl.account_id
      WHERE
        je.organization_id = ${orgId}
        AND je.status       = 'POSTED'
        AND je.date        <= ${cutoff}
      GROUP BY jl.account_id, a.nature, a.subtype
    `;

    return rows.map((r) => ({
      accountId: r.account_id,
      totalDebit: new Prisma.Decimal(r.total_debit),
      totalCredit: new Prisma.Decimal(r.total_credit),
      nature: r.nature,
      subtype: r.subtype,
    }));
  }

  /**
   * Agrega los movimientos de JournalLine de asientos POSTED dentro de un rango de fechas.
   * Utilizado para el Estado de Resultados (on-the-fly por rango).
   *
   * Misma estrategia que aggregateJournalLinesUpTo — una sola query, sin N+1.
   */
  async aggregateJournalLinesInRange(
    orgId: string,
    dateFrom: Date,
    dateTo: Date,
  ): Promise<MovementAggregation[]> {
    const rows = await this.db.$queryRaw<RawAggregation[]>`
      SELECT
        jl.account_id,
        SUM(jl.debit)  AS total_debit,
        SUM(jl.credit) AS total_credit,
        a.nature,
        a.subtype
      FROM journal_lines  jl
      JOIN journal_entries je ON je.id = jl.journal_entry_id
      JOIN accounts         a  ON a.id  = jl.account_id
      WHERE
        je.organization_id = ${orgId}
        AND je.status       = 'POSTED'
        AND je.date        >= ${dateFrom}
        AND je.date        <= ${dateTo}
      GROUP BY jl.account_id, a.nature, a.subtype
    `;

    return rows.map((r) => ({
      accountId: r.account_id,
      totalDebit: new Prisma.Decimal(r.total_debit),
      totalCredit: new Prisma.Decimal(r.total_credit),
      nature: r.nature,
      subtype: r.subtype,
    }));
  }

  /**
   * Escribe un registro en AuditLog cuando la ecuación contable falla (REQ-6, D10).
   * No bloquea la generación — se llama después de retornar el estado financiero.
   *
   * entityId: "financial_statement" (no hay entidad DB específica)
   * action: "IMBALANCE_DETECTED"
   * newValues: { delta (string para evitar pérdida de precisión), date }
   */
  async writeImbalanceAuditLog(
    orgId: string,
    payload: { date: Date; delta: Prisma.Decimal },
  ): Promise<void> {
    await this.db.auditLog.create({
      data: {
        organizationId: orgId,
        entityType: "financial_statement",
        entityId: "financial_statement",
        action: "IMBALANCE_DETECTED",
        newValues: {
          delta: payload.delta.toFixed(2),
          date: payload.date.toISOString(),
        },
      },
    });
  }
}
