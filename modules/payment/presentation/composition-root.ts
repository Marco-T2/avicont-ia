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
import { PrismaAccountBalancesAdapter } from "../infrastructure/adapters/prisma-account-balances.adapter";
import { PrismaPaymentWithRelationsReaderAdapter } from "../infrastructure/adapters/payment-with-relations.reader.adapter";
import type { PaymentWithRelationsReaderPort } from "../domain/ports/payment-with-relations-reader.port";
import { PaymentService } from "./payment-service.adapter";

export { PrismaPaymentsRepository };
export { PaymentService } from "./payment-service.adapter";

export function makePaymentsService(): PaymentsService {
  return new PaymentsService({
    repo: new PrismaPaymentsRepository(),
    receivables: new LegacyReceivablesAdapter(),
    payables: new LegacyPayablesAdapter(),
    contacts: new LegacyContactReadAdapter(),
    orgSettings: new LegacyOrgSettingsAdapter(),
    fiscalPeriods: new LegacyFiscalPeriodsAdapter(),
    accounting: new LegacyAccountingAdapter(),
    accountBalances: new PrismaAccountBalancesAdapter(),
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
    accountBalances: new PrismaAccountBalancesAdapter(),
  });
}

// ── Adapter Layer wiring (canonical R4 exception path EXACT mirror α-A3.B
// paired C1b-α `89e6441` precedent) — composition-root.ts is the ONE
// legitimate exception to R4 (presentation/ MUST NOT import infrastructure/).
// Reader port + Adapter factory + class re-export form the canonical chain
// callsite → server.ts barrel → composition-root → payment-service.adapter.

export function makePaymentReader(): PaymentWithRelationsReaderPort {
  return new PrismaPaymentWithRelationsReaderAdapter();
}

export function makePaymentServiceAdapter(): PaymentService {
  return new PaymentService(makePaymentReader(), makePaymentsService());
}
