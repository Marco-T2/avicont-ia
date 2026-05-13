import type { Prisma } from "@/generated/prisma/client";
import { NotFoundError } from "@/features/shared/errors";

type Decimal = Prisma.Decimal;

// ── Tipos mínimos para el repositorio inyectado ──
// El resolver recibe solo los métodos que necesita, no el repo completo.
// Esto facilita mocking en tests y mantiene la dependencia mínima.
type BalanceResolverRepo = {
  findFiscalPeriod(
    orgId: string,
    periodId: string,
  ): Promise<{ id: string; status: string; startDate: Date; endDate: Date } | null>;

  findAccountBalances(
    orgId: string,
    periodId: string,
  ): Promise<Array<{ accountId: string; balance: Decimal }>>;

  aggregateJournalLinesUpTo(
    orgId: string,
    date: Date,
  ): Promise<
    Array<{
      accountId: string;
      totalDebit: Decimal;
      totalCredit: Decimal;
      nature: "DEUDORA" | "ACREEDORA";
    }>
  >;
};

type BalanceSource = "snapshot" | "on-the-fly";

type ResolvedBalanceResult = {
  balances: Array<{ accountId: string; balance: Decimal }>;
  source: BalanceSource;
  preliminary: boolean;
};

type ResolveBalancesParams = {
  orgId: string;
  date: Date;
  periodId?: string;
};

/**
 * Resuelve la fuente de datos de saldos según el estado del período (D7).
 *
 * Reglas (REQ-4):
 * - Con periodId + período CLOSED + fecha === endDate → snapshot de AccountBalance
 * - Cualquier otro caso → agregación on-the-fly de JournalLine POSTED
 *
 * El cálculo del saldo on-the-fly aplica la convención de signo documentada
 * en account-balances.repository.ts:68-72:
 *   DEUDORA:   balance = totalDebit − totalCredit
 *   ACREEDORA: balance = totalCredit − totalDebit
 *
 * Función (casi) pura: no tiene estado propio — la dependencia del repo
 * se inyecta por parámetro (variante pragmática, decisión D7).
 */
export async function resolveBalances(
  repo: BalanceResolverRepo,
  params: ResolveBalancesParams,
): Promise<ResolvedBalanceResult> {
  // ── Con periodId: intentar snapshot si cumple condiciones ──
  if (params.periodId) {
    const period = await repo.findFiscalPeriod(params.orgId, params.periodId);

    if (!period) {
      throw new NotFoundError("Período fiscal");
    }

    // Condición snapshot: período cerrado Y la fecha solicitada es exactamente la fecha de cierre
    if (period.status === "CLOSED" && isSameDay(params.date, period.endDate)) {
      const snapshots = await repo.findAccountBalances(params.orgId, params.periodId);
      // Los snapshots ya vienen con el balance signed-net (convención D6)
      return {
        balances: snapshots.map((s) => ({ accountId: s.accountId, balance: s.balance })),
        source: "snapshot",
        preliminary: false,
      };
    }
  }

  // ── Fallback: agregación on-the-fly ──
  const aggregations = await repo.aggregateJournalLinesUpTo(params.orgId, params.date);

  return {
    balances: aggregations.map((a) => ({
      accountId: a.accountId,
      // Aplica convención de signo idéntica al writer de account-balances.repository.ts:68-72
      balance:
        a.nature === "DEUDORA"
          ? a.totalDebit.minus(a.totalCredit)
          : a.totalCredit.minus(a.totalDebit),
    })),
    source: "on-the-fly",
    preliminary: true,
  };
}

/**
 * Compara si dos fechas representan el mismo día calendario (ignora la hora).
 * Usa comparación de timestamp con truncado a día via toDateString para evitar
 * problemas de zona horaria en comparaciones date-only.
 */
function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}
