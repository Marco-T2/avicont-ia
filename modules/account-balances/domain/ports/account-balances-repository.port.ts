import type { AccountBalanceWithRelations } from "../account-balances.types";

/**
 * Outbound port for the AccountBalance read/write access `AccountBalances
 * Service` needs. R2 paydown -- the service used to import the concrete
 * `AccountBalancesRepository` straight from `infrastructure/`; this port
 * narrows that reach to exactly the two methods used (`findByPeriod` +
 * `upsert`). Implemented by the existing `AccountBalancesRepository` (infra
 * is R2/R5-exempt) -- see
 * `modules/account-balances/presentation/composition-root.ts` for wiring.
 *
 * Opaque-token pattern (R5, already closed): `tx` stays `unknown` so this
 * port -- and the application service that depends on it -- never import
 * `@/generated/prisma/*`. The concrete adapter narrows it to
 * `Prisma.TransactionClient` internally.
 */
export interface AccountBalancesRepositoryPort {
  findByPeriod(
    organizationId: string,
    periodId: string,
    accountId?: string,
  ): Promise<AccountBalanceWithRelations[]>;

  upsert(
    tx: unknown,
    accountId: string,
    periodId: string,
    orgId: string,
    debitDelta: number | string,
    creditDelta: number | string,
    nature: string,
  ): Promise<void>;
}
