import "server-only";
import { BaseRepository } from "@/features/shared/base.repository";
import { Prisma } from "@/generated/prisma/client";
import type { AccountSubtype } from "@/generated/prisma/enums";
import type { AccountMetadata, MovementAggregation } from "./financial-statements.types";

// ── Tipos de retorno específicos del repositorio ──

type FiscalPeriodRow = {
  id: string;
  status: string;
  startDate: Date;
  endDate: Date;
};

type AccountBalanceRow = {
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
        isContraAccount: true,
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
      isContraAccount: a.isContraAccount,
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
        jl."accountId" AS account_id,
        SUM(jl.debit)  AS total_debit,
        SUM(jl.credit) AS total_credit,
        a.nature,
        a.subtype
      FROM journal_lines  jl
      JOIN journal_entries je ON je.id = jl."journalEntryId"
      JOIN accounts         a  ON a.id  = jl."accountId"
      WHERE
        je."organizationId" = ${orgId}
        AND je.status       = 'POSTED'
        AND je.date        <= ${cutoff}
      GROUP BY jl."accountId", a.nature, a.subtype
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
        jl."accountId" AS account_id,
        SUM(jl.debit)  AS total_debit,
        SUM(jl.credit) AS total_credit,
        a.nature,
        a.subtype
      FROM journal_lines  jl
      JOIN journal_entries je ON je.id = jl."journalEntryId"
      JOIN accounts         a  ON a.id  = jl."accountId"
      WHERE
        je."organizationId" = ${orgId}
        AND je.status       = 'POSTED'
        AND je.date        >= ${dateFrom}
        AND je.date        <= ${dateTo}
      GROUP BY jl."accountId", a.nature, a.subtype
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
   * Ejecuta N aggregateJournalLinesUpTo en paralelo, uno por cada bucket de columna BS.
   * Retorna un Map de columnId → MovementAggregation[] para que el service arme columnas.
   * Estrategia: Option C (Promise.all sobre el método existente) — ver diseño §2.
   */
  async aggregateJournalLinesUpToBulk(
    orgId: string,
    buckets: Array<{ columnId: string; asOfDate: Date }>,
  ): Promise<Map<string, MovementAggregation[]>> {
    const results = await Promise.all(
      buckets.map(async (bucket) => {
        const aggregations = await this.aggregateJournalLinesUpTo(orgId, bucket.asOfDate);
        return { columnId: bucket.columnId, aggregations };
      }),
    );

    const map = new Map<string, MovementAggregation[]>();
    for (const { columnId, aggregations } of results) {
      map.set(columnId, aggregations);
    }
    return map;
  }

  /**
   * Ejecuta N aggregateJournalLinesInRange en paralelo, uno por cada bucket de columna IS.
   * Retorna un Map de columnId → MovementAggregation[] para que el service arme columnas.
   * Estrategia: Option C (Promise.all sobre el método existente) — ver diseño §2.
   */
  async aggregateJournalLinesInRangeBulk(
    orgId: string,
    buckets: Array<{ columnId: string; dateFrom: Date; dateTo: Date }>,
  ): Promise<Map<string, MovementAggregation[]>> {
    const results = await Promise.all(
      buckets.map(async (bucket) => {
        const aggregations = await this.aggregateJournalLinesInRange(
          orgId,
          bucket.dateFrom,
          bucket.dateTo,
        );
        return { columnId: bucket.columnId, aggregations };
      }),
    );

    const map = new Map<string, MovementAggregation[]>();
    for (const { columnId, aggregations } of results) {
      map.set(columnId, aggregations);
    }
    return map;
  }

}
