/**
 * account-balances.types.ts -- domain-owned mirror of the infra
 * `AccountBalanceWithRelations` shape (R2 paydown, application → infra
 * closure). Plain types only, NO `@/generated/prisma` import -- the infra
 * repository keeps its Prisma-derived version
 * (`infrastructure/account-balances.types.ts`) and maps at the boundary.
 * Same [DTO] pattern already used elsewhere (e.g.
 * `modules/accounting/domain/ports/voucher-pdf-exporter.port.ts`).
 *
 * `debitTotal` / `creditTotal` / `balance` stay `unknown` (Prisma.Decimal at
 * the infra boundary) -- callers that need arithmetic already coerce via
 * `new Decimal(String(...))` (see `LedgerService.getTrialBalance`), so the
 * opaque type here changes nothing about runtime behavior.
 */

export interface AccountBalanceWithRelations {
  id: string;
  organizationId: string;
  accountId: string;
  periodId: string;
  debitTotal: unknown;
  creditTotal: unknown;
  balance: unknown;
  account: {
    id: string;
    code: string;
    name: string;
    type: string;
    nature: string;
  };
  period: {
    id: string;
    name: string;
    year: number;
  };
}
