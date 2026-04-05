import type { AccountBalance, Account, FiscalPeriod } from "@/generated/prisma/client";

// ── Composite types ──

export type AccountBalanceWithRelations = AccountBalance & {
  account: Pick<Account, "id" | "code" | "name" | "type" | "nature">;
  period: Pick<FiscalPeriod, "id" | "name" | "year">;
};
