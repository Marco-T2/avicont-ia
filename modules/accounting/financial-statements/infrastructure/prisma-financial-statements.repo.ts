import "server-only";
import { BaseRepository } from "@/modules/shared/infrastructure/base.repository";
import Decimal from "decimal.js";
import { FINALIZED_JE_STATUSES_SQL } from "@/modules/accounting/shared/infrastructure/journal-status.sql";
import type { AccountSubtype } from "@/generated/prisma/enums";
import type {
  AccountMetadata,
  MovementAggregation,
} from "../domain/types/financial-statements.types";
import type {
  FinancialStatementsQueryPort,
  FiscalPeriodRow,
  AccountBalanceRow,
  OrgMetadata,
} from "../domain/ports/financial-statements-query.port";

/**
 * Prisma implementation of FinancialStatementsQueryPort.
 *
 * Lifted from `features/accounting/financial-statements/financial-statements.repository.ts`
 * (233 LOC). Renamed to PrismaFinancialStatementsRepo per hex naming convention.
 * Implements all 7 methods confirmed from S1 actual surface — the port reflects
 * the service's actual consumption (not the narrowed 4-method design §3 estimate).
 *
 * Extends BaseRepository for injectable PrismaClient + requireOrg() scope helper.
 */
export class PrismaFinancialStatementsRepo
  extends BaseRepository
  implements FinancialStatementsQueryPort
{
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
   */
  async aggregateJournalLinesUpTo(orgId: string, date: Date): Promise<MovementAggregation[]> {
    const cutoff = date;

    // ── Tipos de fila raw devuelta por las queries de agregación ──
    type RawAggregation = {
      account_id: string;
      total_debit: string;
      total_credit: string;
      nature: "DEUDORA" | "ACREEDORA";
      subtype: AccountSubtype | null;
    };

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
        AND je.status       ${FINALIZED_JE_STATUSES_SQL}
        AND je.date        <= ${cutoff}
      GROUP BY jl."accountId", a.nature, a.subtype
    `;

    return rows.map((r) => ({
      accountId: r.account_id,
      // DEC-1 boundary normalization: Prisma's inlined Decimal2 → top-level decimal.js
      totalDebit: new Decimal(r.total_debit),
      totalCredit: new Decimal(r.total_credit),
      nature: r.nature,
      subtype: r.subtype,
    }));
  }

  /**
   * Agrega los movimientos de JournalLine de asientos POSTED dentro de un rango de fechas.
   * Utilizado para el Estado de Resultados (on-the-fly por rango).
   */
  async aggregateJournalLinesInRange(
    orgId: string,
    dateFrom: Date,
    dateTo: Date,
  ): Promise<MovementAggregation[]> {
    // ── Tipos de fila raw ──
    type RawAggregation = {
      account_id: string;
      total_debit: string;
      total_credit: string;
      nature: "DEUDORA" | "ACREEDORA";
      subtype: AccountSubtype | null;
    };

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
        AND je.status       ${FINALIZED_JE_STATUSES_SQL}
        AND je.date        >= ${dateFrom}
        AND je.date        <= ${dateTo}
      GROUP BY jl."accountId", a.nature, a.subtype
    `;

    return rows.map((r) => ({
      accountId: r.account_id,
      // DEC-1 boundary normalization: Prisma's inlined Decimal2 → top-level decimal.js
      totalDebit: new Decimal(r.total_debit),
      totalCredit: new Decimal(r.total_credit),
      nature: r.nature,
      subtype: r.subtype,
    }));
  }

  /**
   * Ejecuta N aggregateJournalLinesUpTo en paralelo, uno por cada bucket de columna BS.
   * Retorna un Map de columnId → MovementAggregation[] para que el service arme columnas.
   * Estrategia: Option C (Promise.all sobre el método existente).
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
   * Estrategia: Option C (Promise.all sobre el método existente).
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

  /**
   * Resuelve metadata de organización para encabezados ejecutivos de PDF/XLSX.
   *
   * Estrategia: JOIN con OrgProfile. Preferimos `profile.razonSocial` (nombre
   * legal/comercial completo) sobre `organization.name` (que suele ser un slug
   * o handle corto). NIT, dirección y ciudad vienen del profile y se exponen
   * por separado (no concatenados) para que el header los renderice en líneas
   * distintas. Si algún campo está en "" (default), devuelve null para ese
   * campo y el exporter lo omite gracefully.
   */
  async getOrgMetadata(orgId: string): Promise<OrgMetadata | null> {
    const org = await this.db.organization.findUnique({
      where: { id: orgId },
      select: {
        name: true,
        profile: {
          select: {
            razonSocial: true,
            nit: true,
            direccion: true,
            ciudad: true,
          },
        },
      },
    });

    if (!org) return null;

    const profile = org.profile;
    const name =
      profile?.razonSocial && profile.razonSocial.trim().length > 0
        ? profile.razonSocial
        : org.name;

    const trimOrNull = (v: string | undefined | null): string | null => {
      const t = v?.trim();
      return t && t.length > 0 ? t : null;
    };

    return {
      name,
      nit: trimOrNull(profile?.nit),
      address: trimOrNull(profile?.direccion),
      city: trimOrNull(profile?.ciudad),
    };
  }
}
