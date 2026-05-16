import type { Prisma } from "@/generated/prisma/client";
import type { AccountMetadata, MovementAggregation } from "../types/financial-statements.types";

// ── Tipos de retorno expuestos por el port ──

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

/**
 * Metadata de la organización para encabezados de exporters (PDF/XLSX).
 *
 * Resolución: prefer OrgProfile (razón social / NIT / dirección / ciudad)
 * y cae a Organization.name si el profile está vacío. Cualquier campo no
 * disponible queda en null — el exporter aplica graceful omission.
 *
 * `address` y `city` se exponen separados para que el header pueda renderizar
 * cada uno en su propia línea (estilo membrete).
 */
export type OrgMetadata = {
  name: string;
  nit: string | null;
  address: string | null;
  city: string | null;
};

/**
 * Port for read-side access to financial-statements data.
 *
 * Lifted from `features/accounting/financial-statements/financial-statements.repository.ts`
 * (PRE-C0 inventory confirmed 6 consumed methods — narrowing further than the 4
 * suggested in design §3 would break service.ts orchestration). Bulk variants are
 * Option C of design §2 (Promise.all over the per-method variant).
 *
 * Implementation: `infrastructure/prisma-financial-statements.repo.ts` (C2).
 */
export interface FinancialStatementsQueryPort {
  /**
   * Busca un período fiscal por ID, scoped a la organización. Retorna null si no existe.
   */
  findFiscalPeriod(orgId: string, periodId: string): Promise<FiscalPeriodRow | null>;

  /**
   * Obtiene los saldos de AccountBalance para un período cerrado (snapshot).
   * El campo `balance` ya está signed-net por la convención del writer (D6).
   */
  findAccountBalances(orgId: string, periodId: string): Promise<AccountBalanceRow[]>;

  /**
   * Metadata de todas las cuentas activas con subtype + nature.
   */
  findAccountsWithSubtype(orgId: string): Promise<AccountMetadata[]>;

  /**
   * Agrega los movimientos de JournalLine de asientos POSTED hasta una fecha de corte.
   */
  aggregateJournalLinesUpTo(orgId: string, date: Date): Promise<MovementAggregation[]>;

  /**
   * Agrega los movimientos de JournalLine de asientos POSTED dentro de un rango.
   */
  aggregateJournalLinesInRange(
    orgId: string,
    dateFrom: Date,
    dateTo: Date,
  ): Promise<MovementAggregation[]>;

  /**
   * Bulk paralelo: N invocaciones de aggregateJournalLinesUpTo, una por bucket.
   */
  aggregateJournalLinesUpToBulk(
    orgId: string,
    buckets: Array<{ columnId: string; asOfDate: Date }>,
  ): Promise<Map<string, MovementAggregation[]>>;

  /**
   * Bulk paralelo: N invocaciones de aggregateJournalLinesInRange, una por bucket.
   */
  aggregateJournalLinesInRangeBulk(
    orgId: string,
    buckets: Array<{ columnId: string; dateFrom: Date; dateTo: Date }>,
  ): Promise<Map<string, MovementAggregation[]>>;

  /**
   * Metadata para encabezados de exporters (nombre, NIT, dirección).
   * Consultada por exportBalanceSheetPdf/Xlsx y exportIncomeStatementPdf/Xlsx.
   * Retorna null si la organización no existe.
   */
  getOrgMetadata(orgId: string): Promise<OrgMetadata | null>;
}
