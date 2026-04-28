import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { PaymentsService } from "../application/payments.service";
import { PrismaPaymentsRepository } from "../infrastructure/prisma-payments.repository";
import { LegacyReceivablesAdapter } from "../infrastructure/adapters/legacy-receivables.adapter";
import { LegacyPayablesAdapter } from "../infrastructure/adapters/legacy-payables.adapter";
import { LegacyContactReadAdapter } from "../infrastructure/adapters/legacy-contact-read.adapter";
import { LegacyOrgSettingsAdapter } from "../infrastructure/adapters/legacy-org-settings.adapter";
import { LegacyFiscalPeriodsAdapter } from "../infrastructure/adapters/legacy-fiscal-periods.adapter";
import { LegacyAccountingAdapter } from "../infrastructure/adapters/legacy-accounting.adapter";
import { LegacyAccountBalancesAdapter } from "../infrastructure/adapters/legacy-account-balances.adapter";

export { PrismaPaymentsRepository };

export function makePaymentsService(): PaymentsService {
  return new PaymentsService({
    repo: new PrismaPaymentsRepository(),
    receivables: new LegacyReceivablesAdapter(),
    payables: new LegacyPayablesAdapter(),
    contacts: new LegacyContactReadAdapter(),
    orgSettings: new LegacyOrgSettingsAdapter(),
    fiscalPeriods: new LegacyFiscalPeriodsAdapter(),
    accounting: new LegacyAccountingAdapter(),
    accountBalances: new LegacyAccountBalancesAdapter(),
  });
}

export function makePaymentsServiceForTx(
  tx: Prisma.TransactionClient,
): PaymentsService {
  return new PaymentsService({
    repo: new PrismaPaymentsRepository(tx),
    receivables: new LegacyReceivablesAdapter(),
    payables: new LegacyPayablesAdapter(),
    contacts: new LegacyContactReadAdapter(),
    orgSettings: new LegacyOrgSettingsAdapter(),
    fiscalPeriods: new LegacyFiscalPeriodsAdapter(),
    accounting: new LegacyAccountingAdapter(),
    accountBalances: new LegacyAccountBalancesAdapter(),
  });
}
